# Base image with Node.js 20
FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

# Install additional OS packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        # Network utilities
        dnsutils \
        iputils-ping \
        net-tools \
        curl \
        wget \
        # Build tools
        build-essential \
        python3 \
        # Utilities
        jq \
        vim \
        fzf \
        bat \
        htop \
        # Audio/Video libraries for VJ application
        ffmpeg \
        libvips-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install only essential global Node.js packages
RUN npm install -g \
    typescript@latest \
    aws-cdk \
    pm2 \
    concurrently

# Create workspace directory
RUN mkdir -p /workspace

# Copy initialization script (firewall removed for simplicity)
COPY init-container.sh /usr/local/bin/init-container.sh
RUN chmod +x /usr/local/bin/init-container.sh

# Switch to vscode user
USER vscode

# Configure shell
RUN echo 'alias ll="ls -la"' >> ~/.bashrc \
    && echo 'alias gs="git status"' >> ~/.bashrc \
    && echo 'alias gp="git pull"' >> ~/.bashrc \
    && echo 'alias dev="yarn dev"' >> ~/.bashrc \
    && echo 'alias test="yarn test"' >> ~/.bashrc \
    && echo 'alias build="yarn build"' >> ~/.bashrc

# Set up ZSH theme and plugins
RUN sed -i 's/ZSH_THEME=".*"/ZSH_THEME="agnoster"/' ~/.zshrc \
    && echo "plugins=(git aws docker yarn node npm vscode)" >> ~/.zshrc

# Configure git (will be overridden by user's git config)
RUN git config --global init.defaultBranch main \
    && git config --global pull.rebase false \
    && git config --global fetch.prune true

# Create necessary directories for v1z3r
RUN mkdir -p ~/.config ~/.cache

# Environment variables for development
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    YARN_CACHE_FOLDER=/home/vscode/.cache/yarn

# Expose ports
EXPOSE 3000 6379

# Default command
CMD ["zsh"]