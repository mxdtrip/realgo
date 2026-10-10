package main

import "testing"

func TestNormalizeRawJSONKeepsUnionAndValidationMetadata(t *testing.T) {
	field := map[string]any{
		"x-doc-raw-json": true,
		"type":           "array",
		"items":          map[string]any{"type": "integer"},
		"x-oneOf":        []any{map[string]any{"type": "integer"}, map[string]any{"type": "string"}},
		"description":    "HTTP status or network state",
	}
	spec := map[string]any{"properties": map[string]any{"status": field, "count": map[string]any{"type": "integer"}}}
	if err := normalize(spec); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"type", "items", "x-doc-raw-json"} {
		if _, ok := field[key]; ok {
			t.Errorf("raw JSON retained %s", key)
		}
	}
	if field["x-oneOf"] == nil || field["description"] == nil {
		t.Fatal("normalization discarded documentation")
	}
	count := spec["properties"].(map[string]any)["count"].(map[string]any)
	if count["type"] != "integer" {
		t.Fatal("normalization changed an ordinary integer")
	}
}

func TestNormalizePointerSliceItemsAndExtensionSpelling(t *testing.T) {
	field := map[string]any{
		"type":                   "array",
		"items":                  map[string]any{"type": "string"},
		"x-doc-items-max-length": 64,
		"x-oneof":                []any{map[string]any{"type": "array"}},
		"x-nullable":             true,
	}
	if err := normalize(field); err != nil {
		t.Fatal(err)
	}
	if field["items"].(map[string]any)["maxLength"] != 64 || field["x-oneOf"] == nil || field["x-nullable"] != true {
		t.Fatal("normalization lost array constraints or union metadata")
	}
	if _, ok := field["x-doc-items-max-length"]; ok {
		t.Fatal("internal annotation was not removed")
	}
	if err := normalize(map[string]any{"x-doc-items-max-length": 64}); err == nil {
		t.Fatal("malformed annotation was silently discarded")
	}
}

func TestNormalizeTypedResponseMetadataAndSchemaReference(t *testing.T) {
	payload := map[string]any{"$ref": "#/definitions/Payload"}
	body := map[string]any{
		"properties":                map[string]any{"data": payload},
		"x-doc-response-extensions": map[string]any{"x-sse": map[string]any{"example": "event: done"}},
	}
	response := map[string]any{"schema": body}
	if err := normalize(response); err != nil {
		t.Fatal(err)
	}
	if response["x-sse"] == nil || payload["$ref"] != "#/definitions/Payload" {
		t.Fatal("response metadata or typed payload was lost")
	}
	if _, ok := body["x-doc-response-extensions"]; ok {
		t.Fatal("internal marker leaked into schema")
	}
	if err := normalize(map[string]any{"schema": map[string]any{
		"x-doc-response-extensions": map[string]any{"properties": "invalid"},
	}}); err == nil {
		t.Fatal("response marker accepted schema properties")
	}
	browser := map[string]any{"$ref": "#/definitions/Client", "x-doc-schema-ref": "#/definitions/BrowserClient"}
	if err := normalize(browser); err != nil {
		t.Fatal(err)
	}
	if browser["$ref"] != "#/definitions/BrowserClient" || len(browser) != 1 {
		t.Fatalf("reference = %#v", browser)
	}
}

func TestAlternativeBodyExampleComesFromDTO(t *testing.T) {
	example := map[string]any{"description": "Report"}
	body := map[string]any{"schema": map[string]any{"$ref": "#/definitions/Report"}}
	spec := map[string]any{
		"definitions": map[string]any{"Report": map[string]any{"example": example}},
		"paths": map[string]any{"/reports": map[string]any{
			"post": map[string]any{"x-json-request-body": body},
			"get":  map[string]any{},
		}},
	}
	copyAlternativeBodyExamples(spec)
	if body["example"].(map[string]any)["description"] != "Report" {
		t.Fatal("DTO example was not copied to the alternative request body")
	}
}
