---
title: Quick Start Guide
order: 15
---

# Getting Started

Welcome to MarkoPress! This guide will help you get up and running quickly.

## Installation

Install MarkoPress using your favorite package manager:

```bash
# npm
npm install -g markopress

# pnpm
pnpm add -g markopress

# yarn
yarn global add markopress
```

## Quick Start

Create a new site with a single command:

```bash
markopress init my-site
cd my-site
pnpm install
pnpm dev
```

## Project Structure

Your new site will have the following structure:

```
my-site/
├── markopress.config.js
├── package.json
└── content/
    ├── pages/
    ├── docs/
    └── blog/
```

## Next Steps

- Read about [Configuration](/docs/configuration)
- Explore [Advanced Features](/docs/advanced/overview)
- Check out the [API Reference](/docs/api/routes)
