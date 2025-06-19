
import React, { useState } from 'react';
import { User as AppUser } from '../types'; 
import { ICONS, DEFAULT_USER_AVATAR } from '../constants';
import { generatePostSuggestion, completePost } from '../services/geminiService';

interface CreatePostFormProps {
  currentUser: AppUser | null;
  onAddPost: (postContent: string) => void; // Parent (App.tsx) handles Nhost logic
}

const CreatePostForm: React.FC<CreatePostFormProps> = ({ currentUser, onAddPost }) => {
  const [postContent, setPostContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postContent.trim() === '' || !currentUser) return;
    onAddPost(postContent);
    setPostContent('');
    setError(null);
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      let suggestion;
      if (postContent.trim()) {
        suggestion = await completePost(postContent);
      } else {
        suggestion = await generatePostSuggestion();
      }
      if (suggestion.startsWith("Error:") || suggestion.startsWith("An unknown error occurred")) {
        setError(suggestion);
        setPostContent('');
      } else {
        setPostContent(suggestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentUser) {
    return null; 
  }

  return (
    <div className="border-b border-gray-700 p-4">
      <div className="flex space-x-3">
        <img src={currentUser.avatarUrl || DEFAULT_USER_AVATAR} alt={currentUser.displayName} className="w-12 h-12 rounded-full" />
        <form onSubmit={handleSubmit} className="flex-1">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What is happening?!"
            className="w-full bg-transparent text-lg p-2 focus:outline-none resize-none min-h-[80px] text-gray-100 placeholder-gray-500"
            rows={3}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800">
            <div className="flex space-x-2">
               <button 
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                title="Generate with AI"
                className="flex items-center text-blue-400 hover:text-blue-300 disabled:opacity-50 p-2 rounded-full hover:bg-blue-500/10 transition-colors"
              >
                <ICONS.GEMINI className="w-5 h-5 mr-1" /> AI Assist
                {isGenerating && <span className="ml-2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>}
              </button>
            </div>
            <button
              type="submit"
              disabled={postContent.trim() === '' || isGenerating}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full disabled:opacity-50 transition-colors"
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePostForm;
