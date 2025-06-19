
import React, { useState } from 'react';
import { Post, Comment as CommentType, User as AppUser } from '../types';
import { ICONS, DEFAULT_USER_AVATAR } from '../constants';
import PostItem from './PostItem'; 

interface CommentViewModalProps {
  post: Post | null;
  currentUser: AppUser | null;
  onClose: () => void;
  onAddComment: (postId: string, content: string) => void;
  onToggleLike: (postId: string) => void;
}

const CommentViewModal: React.FC<CommentViewModalProps> = ({ post, currentUser, onClose, onAddComment, onToggleLike }) => {
  const [newComment, setNewComment] = useState('');

  if (!post || !currentUser) return null;

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() === '') return;
    onAddComment(post.id, newComment);
    setNewComment('');
  };
  
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    
    if (seconds < 5) return 'now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };


  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="comment-modal-title">
      <div className="bg-black border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="comment-modal-title" className="text-xl font-bold text-gray-100">Post details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200" aria-label="Close post details">
            <ICONS.CLOSE className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-hide flex-grow">
          <PostItem post={post} currentUser={currentUser} onToggleLike={onToggleLike} onComment={() => { /* In comment view */ }} />
          
          <div className="p-4 border-t border-gray-700">
            <form onSubmit={handleAddCommentSubmit} className="flex items-start space-x-3">
              <img src={currentUser.avatarUrl || DEFAULT_USER_AVATAR} alt={currentUser.displayName} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Replying to @${post.user?.username || 'user'}`}
                  className="w-full bg-gray-800 text-gray-200 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-500"
                  rows={2}
                  aria-label={`Reply to ${post.user?.username || 'user'}`}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={newComment.trim() === ''}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full disabled:opacity-50 transition-colors"
                  >
                    Reply
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">Replies</h3>
            {post.comments && post.comments.length === 0 ? (
              <p className="text-gray-500">No replies yet. Be the first!</p>
            ) : (
              <ul className="space-y-3">
                {(post.comments || []).map((comment) => (
                  <li key={comment.id} className="flex space-x-3 p-3 bg-gray-900/30 rounded-lg">
                    <img src={comment.user?.avatarUrl || DEFAULT_USER_AVATAR} alt={comment.user?.name || 'User'} className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div>
                      <div className="flex items-center text-sm">
                        <span className="font-bold text-gray-200">{comment.user?.name || 'User'}</span>
                        {comment.isBotComment || comment.user?.isBot ? <ICONS.BOT className="w-4 h-4 text-blue-400 ml-1" title="Bot Persona Comment" /> : null}
                        <span className="text-gray-500 ml-2">@{comment.user?.username || 'user'}</span>
                        <span className="text-gray-500 ml-2">· {timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-gray-300 mt-1">{comment.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentViewModal;
