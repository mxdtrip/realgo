package apidocs

// The pinned CLI scans the actual router package, including handlers and DTOs.
// This package is imported by server, so its aliases and metadata are reachable.
//go:generate go run github.com/go-swagger/go-swagger/cmd/swagger@v0.36.4 generate spec --scan-models --enable-allof-compounding --work-dir ../.. --output swagger.json ./internal/server
//go:generate go run ../../cmd/swagger-normalize swagger.json
