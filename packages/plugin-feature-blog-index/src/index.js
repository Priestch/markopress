/**
 * Blog Index Plugin for MarkoPress
 *
 * Generates a blog index page listing all blog posts
 */

// Store data for extendRoutes to access
let blogPostsData = null;
let blogConfigData = null;

/**
 * Create blog index plugin
 */
export default function blogIndexPlugin(options = {}) {
  const {
    postsPerPage = 10,
    showExcerpts = true,
    showDates = true,
    showAuthors = true,
    path = '/blog',
  } = options;

  const config = { postsPerPage, showExcerpts, showDates, showAuthors };

  return {
    name: '@markopress/plugin-feature-blog-index',
    modules: ['blog'],

    async enhanceModules(modules) {
      const blogModule = modules.find(m => m.id === 'blog');
      if (!blogModule) {
        return;
      }

      // Sort posts by date (newest first)
      const sortedPosts = [...blogModule.files].sort((a, b) => {
        const dateA = new Date(a.processed.frontmatter.date || 0);
        const dateB = new Date(b.processed.frontmatter.date || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Transform to blog post data
      const blogPosts = sortedPosts.map(post => ({
        title: post.processed.frontmatter.title,
        description: post.processed.frontmatter.description,
        date: post.processed.frontmatter.date,
        author: post.processed.frontmatter.author,
        excerpt: post.processed.excerpt,
        link: post.urlPath,
      }));

      // Store for extendRoutes to use
      blogPostsData = blogPosts;
      blogConfigData = config;

      // Add enhancement with sorted posts
      blogModule.enhance('blogPosts', blogPosts);
      blogModule.enhance('blogConfig', config);
      blogModule.enhance('blogIndexPath', path);
    },

    async extendRoutes(routes) {
      if (!blogPostsData || !blogConfigData) return routes;

      // Add blog index route
      routes[path] = {
        path,
        handler: `export async function GET(context, next) {
  context.title = 'Blog';
  context.blogPosts = ${JSON.stringify(blogPostsData)};
  context.blogConfig = ${JSON.stringify(blogConfigData)};
}`,
        component: generateBlogIndexComponent(),
      };

      return routes;
    },
  };
}

/**
 * Generate blog index Marko component
 */
function generateBlogIndexComponent() {
  return `<div class="blog-index">
  <h1>Blog</h1>
  <div class="blog-posts">
    <for|post| of=$global.blogPosts>
      <article class="blog-post-card">
        <h2>
          <a href=post.link>\${post.title}</a>
        </h2>
        <if=post.date>
          <div class="post-date">
            <small>\${new Date(post.date).toLocaleDateString()}</small>
          </div>
        </if>
        <if=post.author>
          <div class="post-author">
            <small>by \${post.author}</small>
          </div>
        </if>
        <if=post.excerpt>
          <div class="post-excerpt">
            <p>\${post.excerpt}</p>
          </div>
        </if>
        <a href=post.link class="read-more">Read more →</a>
      </article>
    </for>
  </div>
</div>

<style>
  .blog-index {
    max-width: var(--content-max-width, 960px);
    margin: 0 auto;
    padding: var(--content-padding, 2rem 1.5rem);
  }

  .blog-posts {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .blog-post-card {
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    padding: 1.5rem;
    background: var(--bg-default, #ffffff);
  }

  .blog-post-card h2 {
    margin: 0 0 0.5rem 0;
  }

  .blog-post-card h2 a {
    color: var(--text-1, #111827);
    text-decoration: none;
  }

  .blog-post-card h2 a:hover {
    color: var(--color-primary-2, #3b82f6);
  }

  .post-date,
  .post-author {
    color: var(--text-3, #6b7280);
    margin-bottom: 0.5rem;
  }

  .post-excerpt {
    margin: 1rem 0;
    color: var(--text-2, #4b5563);
  }

  .read-more {
    display: inline-block;
    color: var(--color-primary-2, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }

  .read-more:hover {
    text-decoration: underline;
  }
</style>
`;
}
