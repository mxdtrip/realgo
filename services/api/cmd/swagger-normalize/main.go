// swagger-normalize preserves JSON scalar unions and pointer-slice constraints.
// go-swagger sees json.RawMessage as a byte array; the explicit annotation
// x-doc-raw-json removes that implementation detail from the HTTP schema.
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func normalize(value any) error {
	switch v := value.(type) {
	case map[string]any:
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
	data, err = json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
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
