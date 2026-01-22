/* eslint-disable @typescript-eslint/no-unused-vars */
import {Request, Response, NextFunction} from 'express';
import knex from '../db/knex';
import {v4 as uuidv4} from 'uuid';

type DBPostRow = {
  id: string;
  parent_id: string | null;
  user_id: string;
  sections: any;
  reaction_count: number;
  retweet_count: number;
  quote_count: number;
  created_at: string;
  retweet_of: string | null;
  reactions: Record<string, number>;
};

type DBUserRow = {
  id: string;
  username: string;
  handle: string;
  profile_picture_url: string | null;
};

function mapPostRowToClientShape(postRow: DBPostRow & DBUserRow) {
  // Handle sections parsing - it might be a string, already parsed JSON, or null/undefined
  let sections = [];
  try {
    if (typeof postRow.sections === 'string') {
      sections = JSON.parse(postRow.sections);
    } else if (Array.isArray(postRow.sections)) {
      sections = postRow.sections;
    } else {
      sections = [];
    }
  } catch (error) {
    console.error('[mapPostRowToClientShape] Error parsing sections:', error);
    sections = [];
  }

  // Handle reactions parsing - it might be a string, already parsed JSON, or null/undefined
  let reactions = {};
  try {
    if (typeof postRow.reactions === 'string') {
      reactions = JSON.parse(postRow.reactions);
    } else if (typeof postRow.reactions === 'object' && postRow.reactions !== null) {
      reactions = postRow.reactions;
    } else {
      reactions = {};
    }
  } catch (error) {
    console.error('[mapPostRowToClientShape] Error parsing reactions:', error);
    reactions = {};
  }

  return {
    id: postRow.id,
    parentId: postRow.parent_id,
    user: {
      id: postRow.user_id,
      username: postRow.username,
      handle: postRow.handle,
      avatar: postRow.profile_picture_url
        ? {uri: postRow.profile_picture_url}
        : null,
      verified: false,
    },
    sections: sections,
    createdAt: postRow.created_at,
    replies: [],
    reactionCount: postRow.reaction_count,
    retweetCount: postRow.retweet_count,
    quoteCount: postRow.quote_count,
    reactions: reactions,
    retweetOf: postRow.retweet_of,
    userReaction: null as string | null,
  };
}

async function fetchRetweetOf(postId: string): Promise<any | null> {
  const row = await knex<DBPostRow>('posts')
    .select(
      'posts.*',
      'users.username',
      'users.handle',
      'users.profile_picture_url',
    )
    .leftJoin('users', 'users.id', 'posts.user_id')
    .where('posts.id', postId)
    .first();

  if (!row) return null;

  // Handle sections parsing - it might be a string, already parsed JSON, or null/undefined
  let sections = [];
  try {
    if (typeof row.sections === 'string') {
      sections = JSON.parse(row.sections);
    } else if (Array.isArray(row.sections)) {
      sections = row.sections;
    } else {
      sections = [];
    }
  } catch (error) {
    console.error('[fetchRetweetOf] Error parsing sections:', error);
    sections = [];
  }

  // Handle reactions parsing - it might be a string, already parsed JSON, or null/undefined
  let reactions = {};
  try {
    if (typeof row.reactions === 'string') {
      reactions = JSON.parse(row.reactions);
    } else if (typeof row.reactions === 'object' && row.reactions !== null) {
      reactions = row.reactions;
    } else {
      reactions = {};
    }
  } catch (error) {
    console.error('[fetchRetweetOf] Error parsing reactions:', error);
    reactions = {};
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    user: {
      id: row.user_id,
      username: row.username,
      handle: row.handle,
      avatar: row.profile_picture_url ? {uri: row.profile_picture_url} : null,
      verified: false,
    },
    sections: sections,
    createdAt: row.created_at,
    replies: [],
    reactionCount: row.reaction_count,
    retweetCount: row.retweet_count,
    quoteCount: row.quote_count,
    reactions: reactions,
    retweetOf: null,
  };
}

function buildReplies(post: any, allPosts: any[]): any {
  const replies = allPosts.filter((p: any) => p.parentId === post.id);
  replies.forEach((r: any) => {
    r.replies = buildReplies(r, allPosts);
  });
  return replies;
}

/**
 * GET /api/posts
 */
export async function getAllPosts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {userId} = req.query; // Optional userId to get user-specific reaction data

    console.log(`[getAllPosts] Called with userId: ${userId}`);

    const rows = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .orderBy('posts.created_at', 'asc');

    const partialPosts = rows.map(mapPostRowToClientShape);

    console.log(`[getAllPosts] Found ${partialPosts.length} posts. Sample reactions:`, 
      partialPosts.slice(0, 2).map(p => ({ id: p.id, reactions: p.reactions, reactionCount: p.reactionCount })));

    // If userId is provided, get user's reactions for all posts
    let userReactions: Record<string, string> = {};
    if (userId) {
      const reactions = await knex('user_reactions')
        .select('post_id', 'reaction_emoji')
        .where({user_id: userId});
      
      userReactions = reactions.reduce((acc: Record<string, string>, reaction: any) => {
        acc[reaction.post_id] = reaction.reaction_emoji;
        return acc;
      }, {});
    }

    // fill retweetOf and add user reactions
    for (const p of partialPosts) {
      if (p.retweetOf) {
        const retweetData = await fetchRetweetOf(p.retweetOf);
        p.retweetOf = retweetData;
      }
      // Add user's reaction if available
      if (userId && userReactions[p.id]) {
        p.userReaction = userReactions[p.id];
        console.log(`[getAllPosts] Added userReaction ${userReactions[p.id]} to post ${p.id}`);
      }
    }

    // build tree
    const allPostsMapped = partialPosts.map(p => ({
      ...p,
      retweet_of: undefined,
    }));
    const rootPosts = allPostsMapped.filter(p => !p.parentId);
    rootPosts.forEach(r => {
      r.replies = buildReplies(r, allPostsMapped);
    });

    return res.json({success: true, data: rootPosts});
  } catch (err) {
    console.error('[getAllPosts] Error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Create a root-level post
 * Body expects: { userId, sections }
 */
export async function createRootPost(req: Request, res: Response) {
  try {
    const {userId, sections} = req.body;
    if (!userId) {
      return res.status(400).json({success: false, error: 'Missing userId'});
    }
    if (!sections || !Array.isArray(sections)) {
      return res
        .status(400)
        .json({success: false, error: 'sections must be an array'});
    }

    const newId = uuidv4();
    const now = new Date();
    
    await knex('posts').insert({
      id: newId,
      parent_id: null,
      user_id: userId,
      sections: JSON.stringify(sections),
      reaction_count: 0,
      retweet_count: 0,
      quote_count: 0,
      reactions: JSON.stringify({}),
      retweet_of: null,
      created_at: now,
    });

    const row = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', newId)
      .first();

    if (!row) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve newly created post',
      });
    }

    const postMapped = mapPostRowToClientShape(row);
    return res.json({success: true, data: postMapped});
  } catch (err: any) {
    console.error('[createRootPost] Error:', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/**
 * Create a reply
 * Body: { parentId, userId, sections }
 * - increments the parent's quote_count in DB
 */
export async function createReply(req: Request, res: Response) {
  try {
    const {parentId, userId, sections} = req.body;
    if (!parentId || !userId || !sections) {
      return res
        .status(400)
        .json({success: false, error: 'Missing parentId, userId or sections'});
    }

    const newId = uuidv4();
    const now = new Date();
    
    await knex('posts').insert({
      id: newId,
      parent_id: parentId,
      user_id: userId,
      sections: JSON.stringify(sections),
      reaction_count: 0,
      retweet_count: 0,
      quote_count: 0,
      reactions: JSON.stringify({}),
      retweet_of: null,
      created_at: now,
    });

    // increment parent's quote_count
    const parentPost = await knex<DBPostRow>('posts')
      .where({id: parentId})
      .first();
    if (parentPost) {
      await knex('posts')
        .where({id: parentId})
        .update({quote_count: parentPost.quote_count + 1});
    }

    const row = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', newId)
      .first();

    if (!row) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve newly created reply',
      });
    }

    const postMapped = mapPostRowToClientShape(row);
    return res.json({success: true, data: postMapped});
  } catch (err: any) {
    console.error('[createReply] Error:', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/**
 * Delete a post
 * - If it's a retweet, decrement the retweet_count of the original post
 * - If it is a reply, decrement the parent's quote_count
 * - Then delete, letting DB CASCADE handle nested replies
 */
export async function deletePost(req: Request, res: Response) {
  try {
    const {postId} = req.params;
    if (!postId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing postId in params'});
    }

    const post = await knex<DBPostRow>('posts').where({id: postId}).first();
    if (!post) {
      return res.status(404).json({success: false, error: 'Post not found'});
    }

    // if retweet, decrement retweet_count of retweet_of
    if (post.retweet_of) {
      const original = await knex<DBPostRow>('posts')
        .where({id: post.retweet_of})
        .first();
      if (original && original.retweet_count > 0) {
        await knex('posts')
          .where({id: original.id})
          .update({retweet_count: original.retweet_count - 1});
      }
    }

    // if reply, decrement parent's quote_count
    if (post.parent_id) {
      const parent = await knex<DBPostRow>('posts')
        .where({id: post.parent_id})
        .first();
      if (parent && parent.quote_count > 0) {
        await knex('posts')
          .where({id: parent.id})
          .update({quote_count: parent.quote_count - 1});
      }
    }

    // DB cascade will remove children
    await knex('posts').where({id: postId}).del();

    return res.json({
      success: true,
      postId,
      retweetOf: post.retweet_of,
      parentId: post.parent_id,
    });
  } catch (err: any) {
    console.error('[deletePost] Error:', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/**
 * PATCH /api/posts/:postId/reaction
 * Body: { reactionEmoji, userId }
 */
export const addReaction = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {postId} = req.params;
    const {reactionEmoji, userId} = req.body;

    if (!postId || !reactionEmoji || !userId) {
      res.status(400).json({
        success: false,
        error: 'Missing postId, reactionEmoji, or userId',
      });
      return;
    }

    const post = await knex<DBPostRow>('posts').where({id: postId}).first();
    if (!post) {
      res.status(404).json({success: false, error: 'Post not found'});
      return;
    }

    // Check if user already has a reaction on this post
    const existingReaction = await knex('user_reactions')
      .where({post_id: postId, user_id: userId})
      .first();

    if (existingReaction) {
      if (existingReaction.reaction_emoji === reactionEmoji) {
        // Same reaction - remove it
        await knex('user_reactions')
          .where({post_id: postId, user_id: userId})
          .del();
      } else {
        // Different reaction - update it
        await knex('user_reactions')
          .where({post_id: postId, user_id: userId})
          .update({reaction_emoji: reactionEmoji});
      }
    } else {
      // No existing reaction - add new one
      await knex('user_reactions').insert({
        post_id: postId,
        user_id: userId,
        reaction_emoji: reactionEmoji,
      });
    }

    // Recalculate reaction counts from user_reactions table
    const reactionCounts = await knex('user_reactions')
      .select('reaction_emoji')
      .count('* as count')
      .where({post_id: postId})
      .groupBy('reaction_emoji');

    const reactionsObj: Record<string, number> = {};
    let totalReactions = 0;

    reactionCounts.forEach((row: any) => {
      const count = parseInt(row.count);
      reactionsObj[row.reaction_emoji] = count;
      totalReactions += count;
    });

    console.log(`[addReaction] Post ${postId}: Calculated reactions:`, reactionsObj, 'Total:', totalReactions);

    // Update the post with new reaction counts
    await knex('posts').where({id: postId}).update({
      reactions: reactionsObj,
      reaction_count: totalReactions,
    });

    console.log(`[addReaction] Post ${postId}: Updated database with reactions`);

    // Get user's current reaction (if any)
    const userReaction = await knex('user_reactions')
      .where({post_id: postId, user_id: userId})
      .first();

    // Get the updated post with user info for proper mapping
    const updatedPostRow = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', postId)
      .first();

    if (!updatedPostRow) {
      res.status(404).json({success: false, error: 'Post not found after update'});
      return;
    }

    // Map to client shape and add user reaction
    const mappedPost = mapPostRowToClientShape(updatedPostRow);
    if (mappedPost) {
      mappedPost.userReaction = userReaction?.reaction_emoji || null;
    }

    console.log(`[addReaction] Post ${postId}: Returning response:`, {
      reactionCount: mappedPost?.reactionCount,
      reactions: mappedPost?.reactions,
      userReaction: mappedPost?.userReaction
    });

    res.json({success: true, data: mappedPost});
  } catch (error: any) {
    console.error('[addReaction] Error:', error);
    res.status(500).json({success: false, error: error.message});
  }
};

/**
 * POST /api/posts/retweet
 * Body: { retweetOf, userId, sections? }
 * - Increments the retweetOf post's retweet_count
 */
export async function createRetweet(req: Request, res: Response) {
  try {
    const {retweetOf, userId, sections = []} = req.body;
    if (!retweetOf || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing retweetOf or userId',
      });
    }

    const newId = uuidv4();
    const now = new Date();
    
    await knex('posts').insert({
      id: newId,
      parent_id: null,
      user_id: userId,
      sections: JSON.stringify(sections),
      reaction_count: 0,
      retweet_count: 0,
      quote_count: 0,
      reactions: JSON.stringify({}),
      retweet_of: retweetOf,
      created_at: now,
    });

    // increment original's retweet_count
    const original = await knex<DBPostRow>('posts')
      .where({id: retweetOf})
      .first();
    if (original) {
      await knex<DBPostRow>('posts')
        .where({id: retweetOf})
        .update({retweet_count: original.retweet_count + 1});
    }

    const row = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', newId)
      .first();

    if (!row) {
      return res.json({success: false, error: 'Failed to fetch retweet post'});
    }

    const mappedPost = mapPostRowToClientShape(row);
    if (mappedPost && mappedPost.retweetOf) {
      mappedPost.retweetOf = await fetchRetweetOf(mappedPost.retweetOf);
    }

    return res.json({success: true, data: mappedPost});
  } catch (err: any) {
    console.error('[createRetweet] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retweet',
    });
  }
}

/**
 * PATCH /api/posts/update
 * Body: { postId, sections }
 * - For editing text sections, etc.
 */
export async function updatePost(req: Request, res: Response) {
  try {
    const {postId, sections} = req.body;
    if (!postId || !sections) {
      return res.status(400).json({
        success: false,
        error: 'Missing postId or sections',
      });
    }

    await knex('posts')
      .where({id: postId})
      .update({sections: JSON.stringify(sections)});

    const updatedRow = await knex<DBPostRow>('posts')
      .select(
        'posts.*',
        'users.username',
        'users.handle',
        'users.profile_picture_url',
      )
      .leftJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', postId)
      .first();

    if (!updatedRow) {
      return res.json({success: false, error: 'Post not found after update'});
    }
    const mappedPost = mapPostRowToClientShape(updatedRow);

    return res.json({success: true, data: mappedPost});
  } catch (error: any) {
    console.error('[updatePost] Error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
