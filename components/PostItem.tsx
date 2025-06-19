
import React from 'react';
import { Post, User as AppUser } from '../types'; 
import { ICONS, DEFAULT_USER_AVATAR } from '../constants';

interface PostItemProps {
  post: Post;
  currentUser: AppUser | null;
  onToggleLike: (postId: string) => void;
  onComment: (post: Post) => void;
}

const PostItem: React.FC<PostItemProps> = ({ post, currentUser, onToggleLike, onComment }) => {
  // isLikedByCurrentUser is now directly on the post object, determined by App.tsx
  const isLiked = post.isLikedByCurrentUser || false;

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 5) return 'now';
    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };
  
  const commentCount = post.comments_aggregate?.aggregate?.count || 0;
  const likeCount = post.likes_aggregate?.aggregate?.count || 0;

  return (
    <article className="border-b border-gray-700 p-4 hover:bg-gray-900/50 transition-colors duration-150 cursor-pointer" onClick={() => onComment(post)}>
      <div className="flex space-x-3">
        <img src={post.user?.avatarUrl || DEFAULT_USER_AVATAR} alt={post.user?.name || 'Unknown User'} className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center text-sm">
            <span className="font-bold text-gray-100">{post.user?.name || 'Unknown User'}</span>
            {post.user?.isBot || post.is_bot_post ? <ICONS.BOT className="w-4 h-4 text-blue-400 ml-1" title="Bot Persona Content" /> : null }
            <span className="text-gray-500 ml-2">@{post.user?.username || 'unknownuser'}</span>
            <span className="text-gray-500 ml-2">· {timeAgo(post.created_at)}</span>
          </div>
          <p className="text-gray-200 mt-1 whitespace-pre-wrap">{post.content}</p>
          {post.image_url && <img src={post.image_url} alt="Post image" className="mt-2 rounded-lg max-h-96 w-full object-cover border border-gray-700" />}
          <div className="flex justify-between items-center mt-3 text-gray-500 max-w-xs">
            <button 
              onClick={(e) => { e.stopPropagation(); onComment(post); }} 
              className="flex items-center space-x-1 hover:text-blue-400 group"
              title="Reply"
              aria-label={`Reply to post by ${post.user?.name || 'Unknown User'}`}
            >
              <div className="p-2 group-hover:bg-blue-500/10 rounded-full">
                <ICONS.COMMENT className="w-5 h-5" />
              </div>
              <span>{commentCount}</span>
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); alert('Retweet not implemented'); }} 
                className="flex items-center space-x-1 hover:text-green-400 group"
                title="Retweet"
                aria-label="Retweet post"
            >
                 <div className="p-2 group-hover:bg-green-500/10 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>
                 </div>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleLike(post.id); }} 
              className={`flex items-center space-x-1 group ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
              title={isLiked ? "Unlike" : "Like"}
              aria-pressed={isLiked}
              aria-label={isLiked ? "Unlike post" : "Like post"}
            >
              <div className={`p-2 group-hover:bg-pink-500/10 rounded-full ${isLiked ? 'text-pink-500' : ''}`}>
                {isLiked ? <ICONS.LIKED className="w-5 h-5" /> : <ICONS.LIKE className="w-5 h-5" />}
              </div>
              <span>{likeCount}</span>
            </button>
             <button 
                onClick={(e) => { e.stopPropagation(); alert('Bookmark not implemented'); }} 
                className="flex items-center space-x-1 hover:text-blue-400 group"
                title="Bookmark"
                aria-label="Bookmark post"
            >
                 <div className="p-2 group-hover:bg-blue-500/10 rounded-full">
                    <ICONS.BOOKMARKS className="w-5 h-5"/>
                 </div>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default PostItem;
