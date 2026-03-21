# AGENTS.md - Agent Guidelines for hd1fernando.github.io

## Project Overview

This is a Hugo static site - a personal blog/portfolio deployed to GitHub Pages. The site uses the Typo Hugo theme and is built with Hugo static site generator.

## Build Commands

### Build the site
```bash
hugo
```

### Build with minification (production)
```bash
hugo --minify
```

### Build with verbose output
hugo -v

### Serve locally with live reload
```bash
hugo server
```

### Serve on specific port
```bash
hugo server -p 1313
```

### Build with cache directory (CI workflow)
```bash
hugo --gc --minify --cacheDir <cache-dir>
```

## Dependencies

- **Hugo Extended**: Version 0.148.0 (in CI)
- **Dart Sass**: Version 1.89.2 (for SCSS compilation)
- **No Node.js dependencies required** (optional npm ci for any JS assets)

## Project Structure

```
/                    # Root
├── hugo.toml        # Hugo configuration
├── archetypes/      # Content archetypes
├── assets/          # SCSS, JS, images (if any)
├── content/         # Markdown content (posts, pages)
├── layouts/         # Custom templates (if any)
├── public/          # Generated output (do not edit)
├── resources/       # Hugo cached assets
└── themes/typo/     # Hugo theme (git submodule)
```

## Content Creation

### Create new post
```bash
hugo new posts/<title>.md
```

### Create new page
```bash
hugo new <page-name>.md
```

## Code Style Guidelines

### General Principles

1. **Keep it simple**: This is a static site - minimal custom code
2. **Use theme conventions**: Follow the Typo theme's patterns
3. **No custom JavaScript**: Prefer CSS solutions over JS when possible
4. **Markdown for content**: All content should be in Markdown files

### Front Matter (YAML)

```yaml
---
title: "Post Title"
date: 2024-01-01
draft: false
tags: ["tag1", "tag2"]
categories: ["category1"]
description: "Brief description for SEO"
---
```

### Naming Conventions

- **Posts**: Use lowercase with hyphens: `2024-01-01-post-title.md`
- **Pages**: Use lowercase with hyphens: `about.md`
- **Images**: Use descriptive lowercase: `diagram-flow.png`
- **Tags/Categories**: Use lowercase, singular form

### Content Guidelines

- Use standard Markdown syntax
- Keep line lengths reasonable (80-120 chars)
- Use relative links for internal navigation
- Add description field for SEO meta tags

### Git Workflow

1. Make changes in working branch
2. Test locally with `hugo server`
3. Commit with descriptive message
4. Push to main - GitHub Actions will deploy

## Workflows

### GitHub Actions CI/CD

The `.github/workflows/hugo.yaml` workflow:
- Runs on every push to main
- Builds with Hugo + Dart Sass
- Minifies output
- Deploys to GitHub Pages

### Manual Deployment

```bash
hugo --minify
# Push public/ to gh-pages branch or use GitHub Actions
```

## Error Handling

- If build fails, check Hugo version compatibility
- Verify all theme submodules are fetched: `git submodule update --init --recursive`
- Clear cache if needed: `rm -rf resources/_gen`

## Notes for Agents

- This is a personal blog - prioritize content correctness over features
- Do NOT modify the public/ directory directly (it's generated)
- Do NOT commit large binary files
- Keep custom CSS minimal - consider using theme's built-in options
- Test any changes locally before committing
