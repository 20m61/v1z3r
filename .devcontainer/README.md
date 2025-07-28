# v1z3r Dev Container Setup

This directory contains the development container configuration for the v1z3r VJ Application, following Anthropic's security best practices for Claude Code.

## 🚀 Quick Start

### Prerequisites
- VS Code with Remote - Containers extension
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- At least 8GB of RAM allocated to Docker

### Setup Steps

1. **Open in VS Code**
   ```bash
   code .
   ```

2. **Reopen in Container**
   - VS Code will detect the `.devcontainer` folder
   - Click "Reopen in Container" when prompted
   - Or use Command Palette: `Remote-Containers: Reopen in Container`

3. **Wait for Build**
   - First-time setup takes 5-10 minutes
   - Subsequent starts are much faster due to caching

4. **Start Development**
   - The container automatically runs `yarn install` and `yarn build:modules`
   - Then starts the dev server with `yarn dev`
   - Access the application at http://localhost:3000

## 🔧 Configuration

### Included Services

- **Main Dev Container**: Node.js 20 with development tools
- **Redis** (optional): For session storage and caching
- **PostgreSQL** (optional): For future database needs

### Security Features

Following Anthropic's recommendations:
- Custom firewall with whitelist-based network access
- Restricted outbound connections to necessary services only
- Isolated development environment
- Security capabilities limited to debugging needs

### VS Code Extensions

The container automatically installs:
- ESLint & Prettier for code quality
- TypeScript & Tailwind CSS support
- Jest test runner
- Git tools (GitLens, Git Graph)
- AWS Toolkit
- Docker support

### Performance Optimizations

- Named volumes for `node_modules` and `.next` cache
- Bind mount with cached consistency
- Separate volume for Yarn cache
- Host network mode for better performance

## 📁 File Structure

```
.devcontainer/
├── devcontainer.json    # Main configuration
├── docker-compose.yml   # Multi-service setup
├── Dockerfile          # Container image definition
├── init-firewall.sh    # Security firewall script
└── README.md          # This file
```

## 🛠️ Customization

### Environment Variables

Edit `docker-compose.yml` to add environment variables:
```yaml
environment:
  - MY_CUSTOM_VAR=value
```

### Additional Services

Add services to `docker-compose.yml`:
```yaml
services:
  my-service:
    image: my-image:latest
    # ... configuration
```

### VS Code Settings

Modify `devcontainer.json` to customize VS Code:
```json
"customizations": {
  "vscode": {
    "settings": {
      // Your settings
    }
  }
}
```

## 🔒 Security Notes

1. **Network Access**: The firewall restricts network access to:
   - Package registries (npm, yarn)
   - Git repositories (GitHub, GitLab, Bitbucket)
   - AWS services (S3, DynamoDB, Lambda)
   - Local development ports

2. **User Permissions**: Runs as non-root `vscode` user

3. **Capabilities**: Only includes necessary capabilities for debugging

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Clean up volumes
docker-compose -f .devcontainer/docker-compose.yml down -v
# Rebuild
docker-compose -f .devcontainer/docker-compose.yml build --no-cache
```

### Permission Issues
```bash
# Fix ownership inside container
sudo chown -R vscode:vscode /workspace
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000
# Or change port in devcontainer.json
```

### Slow Performance
- Increase Docker memory allocation
- Use WSL2 backend on Windows
- Exclude large directories from bind mounts

## 📚 Resources

- [VS Code Dev Containers](https://code.visualstudio.com/docs/remote/containers)
- [Anthropic Claude Code DevContainer Guide](https://docs.anthropic.com/ja/docs/claude-code/devcontainer)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🤝 Contributing

When updating the dev container:
1. Test changes locally
2. Document any new requirements
3. Update this README
4. Submit PR with clear description

---

**Note**: Always use dev containers with trusted repositories only. The security model assumes the code being developed is trustworthy.