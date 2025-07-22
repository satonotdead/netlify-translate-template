const { DeepLClient } = require('deepl-node');
const GhostAdminAPI = require('@tryghost/admin-api');
const verifyGhostSignature = require('../../utils/verifyGhostSignature').default;
require('dotenv').config();

// Initialize the DeepL client
const deeplClient = new DeepLClient(process.env.DEEPL_AUTH_KEY);

// Initialize Ghost Admin API
const ghostAdmin = new GhostAdminAPI({
  url: process.env.GHOST_ADMIN_API_URL,
  key: process.env.GHOST_ADMIN_API_KEY,
  version: 'v5.0'
});

// Get target languages from environment variable
const TARGET_LANGUAGES = (process.env.TARGET_LANGUAGES || '').split(',').map(lang => lang.trim().toUpperCase());

// Validate required environment variables
if (!process.env.DEEPL_AUTH_KEY) {
  throw new Error('DEEPL_AUTH_KEY environment variable is required');
}

if (!process.env.TARGET_LANGUAGES) {
  throw new Error('TARGET_LANGUAGES environment variable is required');
}

if (!process.env.GHOST_ADMIN_API_URL || !process.env.GHOST_ADMIN_API_KEY) {
  throw new Error('GHOST_ADMIN_API_URL and GHOST_ADMIN_API_KEY environment variables are required');
}

if (!process.env.GHOST_WEBHOOK_SECRET) {
  throw new Error('GHOST_WEBHOOK_SECRET environment variable is required');
}

/**
 * Translates post content to all target languages
 * @param {Object} post - The Ghost post object
 * @returns {Object} Object containing translations for each target language
 */
async function translatePost(post) {
  const { title, html, custom_excerpt, feature_image_caption, feature_image_alt } = post;
  const translations = {};

  // Translate to all target languages
  for (const targetLang of TARGET_LANGUAGES) {
    const [titleResult, htmlResult, excerptResult, captionResult, altResult] = await Promise.all([
      deeplClient.translateText(title, 'es', targetLang),
      deeplClient.translateText(html, 'es', targetLang),
      custom_excerpt ? deeplClient.translateText(custom_excerpt, 'es', targetLang) : null,
      feature_image_caption ? deeplClient.translateText(feature_image_caption, 'es', targetLang) : null,
      feature_image_alt ? deeplClient.translateText(feature_image_alt, 'es', targetLang) : null
    ]);

    translations[targetLang] = {
      title: titleResult.text,
      html: htmlResult.text,
      excerpt: excerptResult?.text || null,
      feature_image_caption: captionResult?.text || null,
      feature_image_alt: altResult?.text || null
    };
  }

  return translations;
}

/**
 * Creates a new translated post in Ghost
 * @param {Object} originalPost - The original post data
 * @param {string} title - The translated title
 * @param {string} html - The translated HTML content
 * @param {string} custom_excerpt - The translated excerpt
 * @param {string} targetLang - The target language code
 * @param {Object} translation - The translation object containing feature image metadata
 * @returns {Promise<Object>} The created post
 */
async function createTranslatedPost(originalPost, title, html, custom_excerpt, targetLang, translation) {
  try {
    // Create a copy of the original post
    const newPost = { ...originalPost };
    
    // Remove fields that should not be copied
    delete newPost.id;
    delete newPost.uuid;
    delete newPost.slug;
    delete newPost.lexical;
    delete newPost.mobiledoc;
    delete newPost.created_at;

    // Update with translated content
    newPost.title = title;
    newPost.html = html;
    newPost.custom_excerpt = custom_excerpt;
    newPost.feature_image_caption = translation.feature_image_caption;
    newPost.feature_image_alt = translation.feature_image_alt;
    newPost.status = 'draft';
    
    // Update tags and labels
    newPost.tags = [...originalPost.tags.map(tag => tag.name), `#${targetLang}`, process.env.TRANSLATED_LABEL];

    const post = await ghostAdmin.posts.add(newPost, { source: 'html' });
    return post;
  } catch (error) {
    console.error('Error creating translated post:', error);
    throw error;
  }
}

const handler = async (event) => {
  // Handle OPTIONS request for CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    // Verify webhook signature
    try {
      await verifyGhostSignature(event);
    } catch (error) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "Unauthorized",
          details: error.message
        })
      };
    }

    const payload = JSON.parse(event.body);
    
    // Validate Ghost webhook payload
    if (!payload.post || !payload.post.current) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "Invalid Ghost webhook payload"
        })
      };
    }

    // Check if post already has the translation label
    const hasTranslationLabel = payload.post.current.tags.some(tag => 
      tag.name === process.env.TRANSLATED_LABEL
    );

    if (hasTranslationLabel) {
        console.log('Post already translated, skipping translation process');
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          message: "Post already translated, skipping translation process"
        })
      };
    }

    const translations = await translatePost(payload.post.current);
    const createdPosts = [];

    // Create new posts for each translation
    for (const [targetLang, translation] of Object.entries(translations)) {
      const { title, html, excerpt } = translation;
      const newPost = await createTranslatedPost(
        payload.post.current,
        title,
        html,
        excerpt,
        targetLang,
        translation
      );
      createdPosts.push({
        language: targetLang,
        postId: newPost.id
      });
    }
    
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        originalPostId: payload.post.current.id,
        createdPosts
      })
    };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "Translation failed",
        details: error.message
      })
    };
  }
};

module.exports = { handler }; 
