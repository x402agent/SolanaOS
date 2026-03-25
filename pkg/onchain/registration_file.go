// Package onchain :: registration_file.go
//
// Builds 8004-compatible agent registration metadata files.
// These files are pinned to IPFS and referenced on-chain via tokenUri
// when registering an agent with the 8004 Trustless Agent Registry.
//
// The format matches the 8004-solana SDK's buildRegistrationFileJson().
package onchain

// ServiceType mirrors the 8004 SDK ServiceType enum.
type ServiceType string

const (
	ServiceMCP    ServiceType = "mcp"
	ServiceA2A    ServiceType = "a2a"
	ServiceENS    ServiceType = "ens"
	ServiceSNS    ServiceType = "sns"
	ServiceDID    ServiceType = "did"
	ServiceWallet ServiceType = "wallet"
)

// RegistrationService is a single service entry in the registration file.
type RegistrationService struct {
	Type  ServiceType `json:"type"`
	Value string      `json:"value"`
}

// RegistrationFile is the 8004-compatible metadata format pinned to IPFS.
type RegistrationFile struct {
	Name         string                `json:"name"`
	Description  string                `json:"description"`
	Image        string                `json:"image,omitempty"`
	ExternalURL  string                `json:"external_url,omitempty"`
	Services     []RegistrationService `json:"services,omitempty"`
	Skills       []string              `json:"skills,omitempty"`
	Domains      []string              `json:"domains,omitempty"`
	X402Support  bool                  `json:"x402_support,omitempty"`
	Properties   map[string]any        `json:"properties,omitempty"`
}

// RegistrationFileBuilder constructs a RegistrationFile with defaults.
type RegistrationFileBuilder struct {
	file RegistrationFile
}

// NewRegistrationFile starts building an 8004 registration file.
func NewRegistrationFile(name, description string) *RegistrationFileBuilder {
	return &RegistrationFileBuilder{
		file: RegistrationFile{
			Name:        name,
			Description: description,
			Properties:  make(map[string]any),
		},
	}
}

func (b *RegistrationFileBuilder) Image(url string) *RegistrationFileBuilder {
	b.file.Image = url
	return b
}

func (b *RegistrationFileBuilder) ExternalURL(url string) *RegistrationFileBuilder {
	b.file.ExternalURL = url
	return b
}

func (b *RegistrationFileBuilder) AddService(svcType ServiceType, value string) *RegistrationFileBuilder {
	if value != "" {
		b.file.Services = append(b.file.Services, RegistrationService{Type: svcType, Value: value})
	}
	return b
}

func (b *RegistrationFileBuilder) Skills(skills []string) *RegistrationFileBuilder {
	b.file.Skills = skills
	return b
}

func (b *RegistrationFileBuilder) Domains(domains []string) *RegistrationFileBuilder {
	b.file.Domains = domains
	return b
}

func (b *RegistrationFileBuilder) X402(enabled bool) *RegistrationFileBuilder {
	b.file.X402Support = enabled
	return b
}

func (b *RegistrationFileBuilder) Property(key string, value any) *RegistrationFileBuilder {
	b.file.Properties[key] = value
	return b
}

// Build returns the completed RegistrationFile.
func (b *RegistrationFileBuilder) Build() *RegistrationFile {
	return &b.file
}
