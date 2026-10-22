// swagger-normalize corrects scanner limitations without defining HTTP schemas.
// Types, fields, constraints and examples originate in the Go annotations.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func normalize(value any) error {
	switch v := value.(type) {
	case map[string]any:
		// A named swagger:type override inlines only the wrapper's direct
		// fields, losing promoted DTO fields. Reference the generated model
		// instead, so the browser-specific wrapper can embed the real Client.
		if ref, ok := v["x-doc-schema-ref"].(string); ok {
			for _, key := range []string{"type", "format", "properties", "required", "additionalProperties", "x-doc-schema-ref"} {
				delete(v, key)
			}
			v["$ref"] = ref
		}
		// The response scanner accepts schema extensions but does not emit
		// response-level vendor extensions. Promote metadata from the typed
		// body; no parameters or schema fields are synthesized here.
		if schema, ok := v["schema"].(map[string]any); ok {
			if extensions, ok := schema["x-doc-response-extensions"].(map[string]any); ok {
				for key, value := range extensions {
					if len(key) < 2 || key[:2] != "x-" {
						return fmt.Errorf("response extension must start with x-: %s", key)
					}
					v[key] = value
				}
				delete(schema, "x-doc-response-extensions")
			}
		}
		// The comment parser lowercases extension keys. Keep the documented
		// spelling used by operation annotations and downstream tooling.
		for _, key := range []struct{ from, to string }{
			{"x-oneof", "x-oneOf"},
			{"x-anyof", "x-anyOf"},
		} {
			if value, ok := v[key.from]; ok {
				v[key.to] = value
				delete(v, key.from)
			}
		}
		if raw, ok := v["x-doc-raw-json"].(bool); ok && raw {
			delete(v, "type")
			delete(v, "format")
			delete(v, "items")
			delete(v, "$ref")
			delete(v, "x-doc-raw-json")
		}
		// go-swagger's items walker skips pointer-to-slice Go fields.
		if limit, ok := v["x-doc-items-max-length"]; ok {
			items, ok := v["items"].(map[string]any)
			if !ok {
				return fmt.Errorf("x-doc-items-max-length requires array items")
			}
			items["maxLength"] = limit
			delete(v, "x-doc-items-max-length")
		}
		for _, child := range v {
			if err := normalize(child); err != nil {
				return err
			}
		}
	case []any:
		for _, child := range v {
			if err := normalize(child); err != nil {
				return err
			}
		}
	}
	return nil
}

func run(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var spec map[string]any
	if err = json.Unmarshal(data, &spec); err != nil {
		return err
	}
	if err = normalize(spec); err != nil {
		return err
	}
	copyAlternativeBodyExamples(spec)
	data, err = json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// Swagger 2.0 needs an extension for a second request MIME. Keep its example
// sourced from the generated DTO model instead of duplicating it on a handler.
func copyAlternativeBodyExamples(spec map[string]any) {
	definitions, _ := spec["definitions"].(map[string]any)
	paths, _ := spec["paths"].(map[string]any)
	for _, path := range paths {
		operations, _ := path.(map[string]any)
		for _, value := range operations {
			operation, _ := value.(map[string]any)
			body, _ := operation["x-json-request-body"].(map[string]any)
			schema, _ := body["schema"].(map[string]any)
			ref, _ := schema["$ref"].(string)
			if !strings.HasPrefix(ref, "#/definitions/") {
				continue
			}
			model, _ := definitions[strings.TrimPrefix(ref, "#/definitions/")].(map[string]any)
			if example, ok := model["example"]; ok {
				body["example"] = example
			}
		}
	}
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: swagger-normalize path/to/swagger.json")
		os.Exit(2)
	}
	if err := run(os.Args[1]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
