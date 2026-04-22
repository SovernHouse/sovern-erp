#!/bin/bash
#
# Generate Self-Signed SSL Certificate for Development
# Creates a self-signed certificate for local development
#
# Usage: ./generate-ssl-cert.sh [days] [output-dir]
# Example: ./generate-ssl-cert.sh 365 ./backend/certs
#

set -e

# Default values
DAYS=${1:-365}
OUTPUT_DIR=${2:-./backend/certs}
CERT_FILE="$OUTPUT_DIR/server.crt"
KEY_FILE="$OUTPUT_DIR/server.key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}[SSL]${NC} $1"
}

print_error() {
  echo -e "${RED}[SSL] ERROR:${NC} $1" >&2
}

print_warning() {
  echo -e "${YELLOW}[SSL] WARNING:${NC} $1"
}

# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null; then
  print_error "OpenSSL is not installed. Please install it first."
  echo ""
  echo "Installation instructions:"
  echo "  Ubuntu/Debian:  sudo apt-get install openssl"
  echo "  macOS:          brew install openssl"
  echo "  Windows:        Download from https://slproweb.com/products/Win32OpenSSL.html"
  exit 1
fi

print_status "OpenSSL found: $(openssl version)"
echo ""

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  print_warning "Certificate already exists at $CERT_FILE"
  read -p "Overwrite existing certificate? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Certificate generation cancelled"
    exit 0
  fi
fi

# Create output directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
  print_status "Creating directory: $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"
fi

# Generate self-signed certificate
print_status "Generating self-signed certificate..."
print_status "  Validity: $DAYS days"
print_status "  Output: $OUTPUT_DIR"
echo ""

openssl req -x509 \
  -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days "$DAYS" \
  -nodes \
  -subj "/C=US/ST=State/L=City/O=Trading ERP/CN=localhost" \
  2>/dev/null

# Check if generation was successful
if [ $? -eq 0 ]; then
  print_status "Certificate generated successfully!"
  echo ""
  echo "Certificate Details:"
  echo "  Certificate: $CERT_FILE"
  echo "  Private Key: $KEY_FILE"
  echo "  Valid for: $DAYS days"
  echo ""

  # Show certificate info
  print_status "Certificate Information:"
  openssl x509 -in "$CERT_FILE" -text -noout | grep -E "Issuer:|Subject:|Not Before|Not After|Public-Key"
  echo ""

  # Set appropriate file permissions
  chmod 600 "$KEY_FILE"
  chmod 644 "$CERT_FILE"
  print_status "File permissions set correctly"
  echo ""

  # Environment variables guide
  print_status "To use these certificates, set these environment variables:"
  echo ""
  echo "  export SSL_CERT_PATH='$CERT_FILE'"
  echo "  export SSL_KEY_PATH='$KEY_FILE'"
  echo ""
  echo "Or add to your .env file:"
  echo "  SSL_CERT_PATH=$CERT_FILE"
  echo "  SSL_KEY_PATH=$KEY_FILE"
  echo ""

  # Import instructions for different systems
  print_status "To trust this certificate in your browser:"
  echo ""
  echo "  macOS:"
  echo "    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_FILE"
  echo ""
  echo "  Windows (PowerShell as Administrator):"
  echo "    Import-Certificate -FilePath '$CERT_FILE' -CertStoreLocation 'Cert:\LocalMachine\Root'"
  echo ""
  echo "  Linux (most distributions):"
  echo "    sudo cp $CERT_FILE /usr/local/share/ca-certificates/"
  echo "    sudo update-ca-certificates"
  echo ""

  print_warning "This certificate is for development only!"
  print_warning "Use Let's Encrypt or a commercial CA for production"
  echo ""

else
  print_error "Failed to generate certificate"
  exit 1
fi
