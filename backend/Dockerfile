# Build stage: Alpine for small build image
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /backend ./cmd/backend

# Run stage: scratch with binary and root certs for TLS (e.g. Google APIs)
FROM scratch

# Root CA bundle so the app can verify TLS (Firestore, Trace, etc.)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY --from=builder /backend /backend

EXPOSE 8080

ENTRYPOINT ["/backend"]
