package apidocs_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/mxdtrip/realgo/services/api/internal/apidocs"
)

func readSpecification(t *testing.T) map[string]any {
	t.Helper()
	w := httptest.NewRecorder()
	apidocs.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/docs/swagger.json", nil))
	var spec map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &spec); err != nil {
		t.Fatal(err)
	}
	return spec
}

func lookupRef(t *testing.T, spec map[string]any, ref string) any {
	t.Helper()
	if !strings.HasPrefix(ref, "#/") {
		t.Fatalf("non-local reference: %s", ref)
	}
	var value any = spec
	for _, key := range strings.Split(strings.TrimPrefix(ref, "#/"), "/") {
		key = strings.ReplaceAll(strings.ReplaceAll(key, "~1", "/"), "~0", "~")
		object, ok := value.(map[string]any)
		if !ok {
			t.Fatalf("reference traverses non-object: %s", ref)
		}
		value, ok = object[key]
		if !ok {
			t.Fatalf("unresolved reference: %s", ref)
		}
	}
	return value
}

// Expand every schema and named response. Fingerprints cover the HTTP contract,
// including nested DTO constraints, rather than the presentation of Go comments.
// The fixture was captured from the generated specification before this refactor.
func contractValue(t *testing.T, spec map[string]any, value any, stack map[string]bool) any {
	t.Helper()
	switch v := value.(type) {
	case map[string]any:
		if ref, ok := v["$ref"].(string); ok {
			target := lookupRef(t, spec, ref)
			if stack[ref] {
				return map[string]any{"$ref": ref}
			}
			stack[ref] = true
			result := contractValue(t, spec, target, stack)
			delete(stack, ref)
			return result
		}
		result := map[string]any{}
		for key, child := range v {
			if strings.HasPrefix(key, "x-go-") {
				continue
			}
			switch key {
			case "description", "summary", "title", "tags", "example", "examples", "x-example", "x-examples":
				continue
			}
			if key == "required" && child == false {
				continue
			}
			result[key] = contractValue(t, spec, child, stack)
		}
		return result
	case []any:
		result := make([]any, len(v))
		for i, child := range v {
			result[i] = contractValue(t, spec, child, stack)
		}
		return result
	default:
		return value
	}
}

func TestSpecificationRetainsHTTPContract(t *testing.T) {
	spec := readSpecification(t)
	data, err := os.ReadFile("testdata/http_contract.json")
	if err != nil {
		t.Fatal(err)
	}
	var expected map[string]string
	if err := json.Unmarshal(data, &expected); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for path, value := range spec["paths"].(map[string]any) {
		for method, value := range value.(map[string]any) {
			key := strings.ToUpper(method) + " " + path
			seen[key] = true
			operation := contractValue(t, spec, value, map[string]bool{}).(map[string]any)
			for _, field := range []string{"consumes", "produces", "security"} {
				if _, ok := operation[field]; !ok {
					operation[field] = spec[field]
					if operation[field] == nil {
						operation[field] = []any{}
					}
				}
			}
			if params, ok := operation["parameters"].([]any); ok {
				sort.Slice(params, func(i, j int) bool {
					a, b := params[i].(map[string]any), params[j].(map[string]any)
					return fmt.Sprint(a["in"], ":", a["name"]) < fmt.Sprint(b["in"], ":", b["name"])
				})
			}
			canonical, err := json.Marshal(operation)
			if err != nil {
				t.Fatal(err)
			}
			hash := sha256.Sum256(canonical)
			digest := hex.EncodeToString(hash[:])
			if digest != expected[key] {
				t.Errorf("HTTP contract changed for %s: got %s, want %s; compare parameters, responses, security and DTO schemas", key, digest, expected[key])
			}
		}
	}
	for key := range expected {
		if !seen[key] {
			t.Errorf("documented operation lost: %s", key)
		}
	}
}

func TestNamedResponsesAndAllReferences(t *testing.T) {
	spec := readSpecification(t)
	var walk func(any)
	walk = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			for key, child := range v {
				if key == "$ref" {
					lookupRef(t, spec, child.(string))
				}
				if strings.HasPrefix(key, "x-doc-") {
					t.Errorf("internal scanner marker leaked: %s", key)
				}
				walk(child)
			}
		case []any:
			for _, child := range v {
				walk(child)
			}
		}
	}
	walk(spec)
	for path, value := range spec["paths"].(map[string]any) {
		for method, value := range value.(map[string]any) {
			operation := value.(map[string]any)
			for status, value := range operation["responses"].(map[string]any) {
				ref := value.(map[string]any)["$ref"]
				if ref == nil || !strings.HasPrefix(ref.(string), "#/responses/") {
					t.Fatalf("%s %s %s does not reference a named response", method, path, status)
				}
				response := lookupRef(t, spec, ref.(string)).(map[string]any)
				if status == "504" {
					if response["schema"] != nil {
						t.Fatal("timeout incorrectly promises a JSON envelope")
					}
					continue
				}
				headers := response["headers"].(map[string]any)
				if headers["X-Request-Id"] == nil {
					t.Errorf("%s %s %s lost X-Request-Id", method, path, status)
				}
				if status == "204" {
					if response["schema"] != nil {
						t.Fatal("204 has a body schema")
					}
					continue
				}
				schema := response["schema"].(map[string]any)
				if status >= "400" {
					if schema["$ref"] != "#/definitions/ErrorEnvelope" {
						t.Errorf("%s %s %s lost the error DTO", method, path, status)
					}
					continue
				}
				props := schema["properties"].(map[string]any)
				if props["data"] == nil || props["meta"].(map[string]any)["$ref"] != "#/definitions/CommonMeta" {
					t.Errorf("%s %s %s has an incomplete success envelope", method, path, status)
				}
				if !reflect.DeepEqual(schema["required"], []any{"data"}) {
					t.Errorf("success data is not required: %s %s", method, path)
				}
			}
		}
	}
	auth := spec["securityDefinitions"].(map[string]any)["BearerAuth"].(map[string]any)
	if auth["type"] != "apiKey" || auth["in"] != "header" || auth["name"] != "Authorization" {
		t.Fatalf("Authorize contract changed: %#v", auth)
	}
}
