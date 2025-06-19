
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  useNhostClient,
  useAuthenticationStatus,
  useUserData,
  useSignOut,
  useUserId
} from '@nhost/react';
import { gql } from 'graphql-tag';
import { v4 as uuidv4 } from 'uuid'; // For client-side generated IDs if needed

import { User as AppUser, Post, Comment as CommentType, ActiveView, DenormalizedUser } from './types';
import { ICONS, DEFAULT_USER_AVATAR, BOT_PROFILES } from './constants';
import CreatePostForm from './components/CreatePostForm';
import PostItem from './components/PostItem';
import CommentViewModal from './components/CommentViewModal';
import { generatePostSuggestion, generateComment } from './services/geminiService';

// --- GraphQL Queries and Mutations ---
// User data is often fetched via relations, but direct queries can be useful.
// Nhost's useUserData() hook provides current user data.

const GET_POSTS_QUERY = gql`
  query GetPosts($currentUserId: uuid) {
    posts(order_by: { created_at: desc }) {
      id
      content
      image_url
      created_at
      is_bot_post
      user {
        id
        displayName
        avatarUrl
        metadata
      }
      comments_aggregate {
        aggregate {
          count
        }
      }
      comments(order_by: { created_at: asc }) { # Asc for chronological display
        id
        content
        created_at
        is_bot_comment
        user {
          id
          displayName
          avatarUrl
          metadata
        }
      }
      likes_aggregate {
        aggregate {
          count
        }
      }
      # Check if current user liked this post
      # This part needs a specific query or client-side check if 'post_likes' is fetched separately
      # For simplicity, we'll determine 'isLikedByCurrentUser' by checking a list of likes if fetched, or make a separate query.
      # A more direct way in Hasura can be a computed field or a view.
      # For now, we'll manage this client-side based on a separate likes query or by fetching user's likes.
      # Placeholder: we'd need to fetch post_likes where user_id = currentUserId
    }
  }
`;

const GET_POST_BY_ID_QUERY = gql`
  query GetPostById($postId: uuid!, $currentUserId: uuid) {
    posts_by_pk(id: $postId) {
      id
      content
      image_url
      created_at
      is_bot_post
      user {
        id
        displayName
        avatarUrl
        metadata
      }
      comments_aggregate {
        aggregate {
          count
        }
      }
      comments(order_by: { created_at: asc }) {
        id
        content
        created_at
        is_bot_comment
        user {
          id
          displayName
          avatarUrl
          metadata
        }
      }
      likes_aggregate {
        aggregate {
          count
        }
      }
      # Similar to GET_POSTS_QUERY for isLikedByCurrentUser
    }
  }
`;

const ADD_POST_MUTATION = gql`
  mutation AddPost($userId: uuid!, $content: String!, $imageUrl: String, $isBotPost: Boolean) {
    insert_posts_one(object: {user_id: $userId, content: $content, image_url: $imageUrl, is_bot_post: $isBotPost}) {
      id
    }
  }
`;

const ADD_COMMENT_MUTATION = gql`
  mutation AddComment($postId: uuid!, $userId: uuid!, $content: String!, $isBotComment: Boolean) {
    insert_comments_one(object: {post_id: $postId, user_id: $userId, content: $content, is_bot_comment: $isBotComment}) {
      id
      created_at
      content
      is_bot_comment
      user { # Return the user who commented
        id
        displayName
        avatarUrl
        metadata
      }
    }
  }
`;

const LIKE_POST_MUTATION = gql`
  mutation LikePost($postId: uuid!, $userId: uuid!) {
    insert_post_likes_one(object: {post_id: $postId, user_id: $userId}) {
      post_id
      user_id
    }
  }
`;

const UNLIKE_POST_MUTATION = gql`
  mutation UnlikePost($postId: uuid!, $userId: uuid!) {
    delete_post_likes_by_pk(post_id: $postId, user_id: $userId) {
      post_id
      user_id
    }
  }
`;

const GET_USER_LIKES_FOR_POSTS_QUERY = gql`
  query GetUserLikesForPosts($userId: uuid!, $postIds: [uuid!]) {
    post_likes(where: {user_id: {_eq: $userId}, post_id: {_in: $postIds}}) {
      post_id
    }
  }
`;


// Helper to map Nhost user data to AppUser
const mapNhostUserToAppUser = (nhostUser: ReturnType<typeof useUserData>): AppUser | null => {
  if (!nhostUser) return null;
  const metadata = nhostUser.metadata as any || {};
  return {
    id: nhostUser.id,
    email: nhostUser.email,
    displayName: nhostUser.displayName || 'Anonymous',
    avatarUrl: nhostUser.avatarUrl || DEFAULT_USER_AVATAR,
    actualUsername: metadata.actualUsername || nhostUser.displayName?.replace(/\s+/g, '').toLowerCase() || 'user',
    isBot: metadata.isBot || false,
  };
};

const mapGqlPostToAppPost = (gqlPost: any, likedPostIds: Set<string>): Post => {
  const postUser = gqlPost.user;
  const postUserMetadata = postUser?.metadata || {};
  
  const denormalizedPostUser: DenormalizedUser = {
    id: postUser?.id || 'unknown_user_id',
    name: postUser?.displayName || 'Unknown User',
    username: postUserMetadata.actualUsername || postUser?.displayName?.replace(/\s+/g, '').toLowerCase() || 'unknownuser',
    avatarUrl: postUser?.avatarUrl || DEFAULT_USER_AVATAR,
    isBot: postUserMetadata.isBot || false,
  };

  const comments: CommentType[] = (gqlPost.comments || []).map((comment: any) => {
    const commentUser = comment.user;
    const commentUserMetadata = commentUser?.metadata || {};
    const denormalizedCommentUser: DenormalizedUser = {
      id: commentUser?.id || 'unknown_comment_user_id',
      name: commentUser?.displayName || 'Unknown User',
      username: commentUserMetadata.actualUsername || commentUser?.displayName?.replace(/\s+/g, '').toLowerCase() || 'unknownuser',
      avatarUrl: commentUser?.avatarUrl || DEFAULT_USER_AVATAR,
      isBot: commentUserMetadata.isBot || false,
    };
    return {
      id: comment.id,
      postId: gqlPost.id,
      content: comment.content,
      created_at: comment.created_at,
      user: denormalizedCommentUser,
      isBotComment: comment.is_bot_comment || false,
    };
  });


  return {
    id: gqlPost.id,
    content: gqlPost.content,
    image_url: gqlPost.image_url,
    created_at: gqlPost.created_at,
    user: denormalizedPostUser,
    is_bot_post: gqlPost.is_bot_post || false,
    likes_aggregate: gqlPost.likes_aggregate || { aggregate: { count: 0 } },
    comments_aggregate: gqlPost.comments_aggregate || { aggregate: { count: 0 } },
    comments: comments,
    isLikedByCurrentUser: likedPostIds.has(gqlPost.id),
  };
};


const App: React.FC = () => {
  const nhost = useNhostClient();
  const { isLoading: isLoadingAuth, isAuthenticated } = useAuthenticationStatus();
  const nhostUserData = useUserData();
  const { signOut } = useSignOut();
  const currentUserId = useUserId();

  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(null);

  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>(''); // App-specific username for metadata
  const [nameInput, setNameInput] = useState<string>(''); // Display name
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState<boolean>(false);


  const [posts, setPosts] = useState<Post[]>([]);
  const [activeModalPost, setActiveModalPost] = useState<Post | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);
  const [initialBotActivityDone, setInitialBotActivityDone] = useState<boolean>(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const appUser = mapNhostUserToAppUser(nhostUserData);
    setCurrentUserProfile(appUser);
    if (appUser) {
      fetchPostsAndUpdateState();
    } else {
      setPosts([]);
      setInitialBotActivityDone(false);
    }
  }, [nhostUserData, isAuthenticated]);


  const fetchPostsAndUpdateState = async () => {
    if (!isAuthenticated || !currentUserId) {
      setPosts([]);
      setIsLoadingPosts(false);
      return;
    }
    setIsLoadingPosts(true);
    try {
      const { data, error } = await nhost.graphql.request(GET_POSTS_QUERY, { currentUserId });
      if (error || !data) {
        throw error || new Error("Failed to fetch posts: No data returned");
      }
      
      const postIds = data.posts.map((p: any) => p.id);
      let likedPostIds = new Set<string>();
      if (postIds.length > 0 && currentUserId) {
        const likesData = await nhost.graphql.request(GET_USER_LIKES_FOR_POSTS_QUERY, { userId: currentUserId, postIds });
        if (likesData.data?.post_likes) {
          likesData.data.post_likes.forEach((like: any) => likedPostIds.add(like.post_id));
        }
      }

      const fetchedPosts = data.posts.map((p: any) => mapGqlPostToAppPost(p, likedPostIds));
      setPosts(fetchedPosts);

    } catch (err: any) {
      console.error("[App.tsx] Error fetching posts:", err);
      setAuthError(err?.message || "Could not load posts.");
    } finally {
      setIsLoadingPosts(false);
    }
  };
  
  const getActiveView = useCallback((): ActiveView => {
    switch (location.pathname) {
      case '/': return ActiveView.Home;
      case '/explore': return ActiveView.Explore;
      case '/notifications': return ActiveView.Notifications;
      case '/messages': return ActiveView.Messages;
      case '/bookmarks': return ActiveView.Bookmarks;
      case '/profile': return ActiveView.Profile;
      default: return ActiveView.Home;
    }
  }, [location.pathname]);

  const [activeView, setActiveView] = useState<ActiveView>(getActiveView());

  useEffect(() => {
    setActiveView(getActiveView());
  }, [getActiveView]);

  // Bot-related actions
   const handleAIAssistedPost = async (content: string, isBotPersonaPost: boolean) => {
    if (!currentUserProfile) return;
    
    try {
      await nhost.graphql.request(ADD_POST_MUTATION, {
        userId: currentUserProfile.id,
        content: content,
        isBotPost: isBotPersonaPost,
      });
      await fetchPostsAndUpdateState();
      // Further bot interactions can be added here
    } catch (error) {
      console.error(`[App.tsx] Error adding AI-assisted post by @${currentUserProfile.actualUsername}:`, error);
    }
  };
  
 useEffect(() => {
    if (currentUserProfile && !currentUserProfile.isBot && !initialBotActivityDone && BOT_PROFILES.length > 0 && posts.length === 0) {
      const performInitialUserExperienceEnhancements = async () => {
        console.log("[App.tsx] Triggering initial content sequence for real user login...");
        setInitialBotActivityDone(true); 

        const initialBotPersona = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
        try {
          const postContent = await generatePostSuggestion(`a welcome topic from @${initialBotPersona.actualUsername} to the community, posted by @${currentUserProfile.actualUsername}`);
          if (!postContent.startsWith("Error:") && !postContent.startsWith("An unknown error occurred")) {
            await handleAIAssistedPost(postContent, true); 
          } else {
            console.error("[App.tsx] Failed to generate content for initial user experience post:", postContent);
          }
        } catch (error) {
          console.error("[App.tsx] Error during initial user experience post:", error);
        }
      };
      
      setTimeout(performInitialUserExperienceEnhancements, 3000); 
    }
  }, [currentUserProfile, initialBotActivityDone, posts.length]);


  const handleAuthAction = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsProcessingAuth(true);
    try {
      if (isSignUpMode) {
        if (!usernameInput.trim() || !nameInput.trim()) {
          setAuthError("App Username and Name are required for sign up.");
          setIsProcessingAuth(false);
          return;
        }
        const { error } = await nhost.auth.signUp({
          email: emailInput,
          password: passwordInput,
          options: {
            displayName: nameInput.trim(),
            metadata: {
              actualUsername: usernameInput.trim(),
              avatarUrl: `https://picsum.photos/seed/${usernameInput.trim()}/200/200`, // Nhost will use its own default if not specified or storage integration is needed
              isBot: false,
            }
          }
        });
        if (error) throw error;
        // On successful sign-up, Nhost automatically signs the user in.
        // The useEffect listening to nhostUserData will update currentUserProfile and fetch posts.
        setUsernameInput('');
        setNameInput('');
        // Email and password clear on success automatically by Nhost's flow or keep them if preferred
      } else {
        const { error } = await nhost.auth.signIn({
          email: emailInput,
          password: passwordInput,
        });
        if (error) throw error;
      }
      // Clear inputs after successful operation, or rely on page reload/navigation
      setEmailInput('');
      setPasswordInput('');

    } catch (error: any) {
      console.error("[App.tsx] Authentication error:", error);
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleLogout = async () => {
    setIsProcessingAuth(true);
    const { error } = await signOut();
    if (error) {
      console.error("[App.tsx] Logout error:", error);
      setAuthError(error.message || "Logout failed.");
    } else {
      setCurrentUserProfile(null);
      setPosts([]);
      navigate('/');
    }
    setIsProcessingAuth(false);
  };
  
  const triggerAIAssistedComment = async (targetPost: Post) => {
    if (!currentUserProfile || targetPost.user.id === currentUserProfile.id) { 
        console.log(`[App.tsx] AI comment trigger skipped for post ID: ${targetPost.id}`);
        return;
    }
    
    // const randomBotPersona = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)]; // Not used for now, comment uses current user as bot
    try {
      const commentContent = await generateComment(targetPost.content, targetPost.user.username);
      if (!commentContent.startsWith("Error:") && !commentContent.startsWith("An unknown error occurred")) {
        await nhost.graphql.request(ADD_COMMENT_MUTATION, {
          postId: targetPost.id,
          userId: currentUserProfile.id, // The current real user is posting this "bot-generated" comment
          content: commentContent,
          isBotComment: true, // Mark the comment as bot-generated content
        });
        await fetchPostsAndUpdateState(); // Refetch to update comment list
        // Update activeModalPost if it's the one being commented on
        if (activeModalPost && activeModalPost.id === targetPost.id) {
            const freshPostData = await getFreshPostData(targetPost.id);
            if(freshPostData) setActiveModalPost(freshPostData);
        }

      } else {
         console.error(`[App.tsx] Failed to generate AI comment for post ID ${targetPost.id}:`, commentContent);
      }
    } catch (error) {
      console.error(`[App.tsx] Error during AI comment generation or posting for post ID ${targetPost.id}:`, error);
    }
  };

  const handleAddPost = async (postContent: string) => {
    if (!currentUserProfile) return;
    try {
      await nhost.graphql.request(ADD_POST_MUTATION, {
        userId: currentUserProfile.id,
        content: postContent,
        isBotPost: false, // User-initiated posts are not bot posts by default
      });
      await fetchPostsAndUpdateState();
      // Consider triggering AI comment to this new post from a bot persona if desired
      // const newPost = posts.find(p => p.content === postContent && p.user.id === currentUserProfile.id); // This is fragile
      // if (newPost && Math.random() < 0.1) { // 10% chance
      //   setTimeout(() => triggerAIAssistedComment(newPost, true), 3000); // Pass a Bot Profile
      // }
    } catch (error: any) {
      console.error("[App.tsx] Error adding post:", error.message);
      setAuthError(`Failed to add post: ${error.message}`);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUserProfile) return;
    
    const postToUpdate = posts.find(p => p.id === postId) || (activeModalPost?.id === postId ? activeModalPost : null);
    if (!postToUpdate) return;
    
    const mutation = postToUpdate.isLikedByCurrentUser ? UNLIKE_POST_MUTATION : LIKE_POST_MUTATION;
    try {
      await nhost.graphql.request(mutation, { postId, userId: currentUserProfile.id });
      // Optimistic update or refetch
      // For simplicity, refetch the specific post or all posts
      await fetchPostsAndUpdateState(); 
      if (activeModalPost && activeModalPost.id === postId) {
         const freshPostData = await getFreshPostData(postId);
         if(freshPostData) setActiveModalPost(freshPostData);
      }

    } catch (error: any) {
      console.error(`[App.tsx] Error toggling like for post ID ${postId}:`, error);
      setAuthError(`Failed to update like: ${error.message}`);
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!currentUserProfile) return;
    try {
      await nhost.graphql.request(ADD_COMMENT_MUTATION, {
        postId,
        userId: currentUserProfile.id,
        content,
        isBotComment: false, // User comments are not bot comments
      });
      await fetchPostsAndUpdateState(); // Refetch to see new comment
       if (activeModalPost && activeModalPost.id === postId) {
            const freshPostData = await getFreshPostData(postId);
            if(freshPostData) setActiveModalPost(freshPostData);
        }
      // Chance for AI follow-up comment
      const targetPost = posts.find(p => p.id === postId);
      if (targetPost && targetPost.user.id !== currentUserProfile.id && Math.random() < 0.15) { // 15% chance if the post is not by the current user
           console.log(`[App.tsx] Scheduling AI comment attempt on post ID ${targetPost.id} after user comment.`);
           // Note: The AI comment will be posted AS THE CURRENT USER but marked as isBotComment=true
           setTimeout(() => triggerAIAssistedComment(targetPost), 2000 + Math.random() * 3000);
      }

    } catch (error: any) {
      console.error(`[App.tsx] Error adding comment to post ID ${postId}:`, error);
      setAuthError(`Failed to add comment: ${error.message}`);
    }
  };

  const getFreshPostData = async (postId: string): Promise<Post | null> => {
    if (!currentUserId) return null;
    try {
        const { data, error } = await nhost.graphql.request(GET_POST_BY_ID_QUERY, { postId, currentUserId });
        if (error || !data || !data.posts_by_pk) {
            console.error("Error fetching fresh post data:", error);
            return null;
        }
        
        let likedPostIds = new Set<string>();
         if (currentUserId) {
            const likesData = await nhost.graphql.request(GET_USER_LIKES_FOR_POSTS_QUERY, { userId: currentUserId, postIds: [postId] });
            if (likesData.data?.post_likes) {
                likesData.data.post_likes.forEach((like: any) => likedPostIds.add(like.post_id));
            }
        }
        return mapGqlPostToAppPost(data.posts_by_pk, likedPostIds);
    } catch (err) {
        console.error("Error in getFreshPostData:", err);
        return null;
    }
  };
  
  const openCommentModal = async (postToOpen: Post) => {
    const freshPost = await getFreshPostData(postToOpen.id);
    setActiveModalPost(freshPost || postToOpen); 
  };
  const closeCommentModal = () => setActiveModalPost(null);


  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-lg text-gray-300 mr-4">Initializing Nhost authentication...</p>
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUserProfile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-lg shadow-xl w-full max-w-sm">
          <ICONS.POST className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-center text-gray-100 mb-4">
            {isSignUpMode ? 'Sign Up for Servicios Rápidos' : 'Welcome to Servicios Rápidos'}
          </h1>
          <form onSubmit={handleAuthAction}>
            {isSignUpMode && (
              <>
                <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Full Name (Display Name)" className="w-full p-3 mb-3 bg-gray-800 text-gray-200 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" required />
                <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="App Username (e.g., @cooluser)" className="w-full p-3 mb-3 bg-gray-800 text-gray-200 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" required />
              </>
            )}
            <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="Email" className="w-full p-3 mb-3 bg-gray-800 text-gray-200 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" required />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" className="w-full p-3 mb-4 bg-gray-800 text-gray-200 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" required />
            {authError && <p className="text-red-500 text-sm mb-3">{authError}</p>}
            <button type="submit" disabled={isProcessingAuth} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors duration-150 disabled:opacity-50">
              {isProcessingAuth ? 'Processing...' : (isSignUpMode ? 'Sign Up' : 'Log In')}
            </button>
          </form>
          <button onClick={() => { setIsSignUpMode(!isSignUpMode); setAuthError(null); }} className="w-full mt-4 text-sm text-blue-400 hover:text-blue-300 text-center">
            {isSignUpMode ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  interface NavLinkProps {
    to: ActiveView;
    icon: React.ReactElement<React.SVGProps<SVGSVGElement>>;
    label: string;
  }

  const NavLink: React.FC<NavLinkProps> = ({ to, icon, label }) => {
    const path = to === ActiveView.Home ? '/' : `/${to.toLowerCase()}`;
    return (
      <Link
        to={path}
        onClick={() => setActiveView(to)}
        className={`flex items-center space-x-3 p-3 rounded-full hover:bg-gray-800 transition-colors w-full ${activeView === to ? 'font-bold text-white' : 'text-gray-400 hover:text-gray-200'}`}
      >
        {React.cloneElement(icon, { className: "w-7 h-7" })}
        <span className="text-xl hidden xl:inline">{label}</span>
      </Link>
    );
  };

  const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold text-gray-200 mb-4">{title}</h1>
      <p className="text-gray-400">This page is under construction. Check back later!</p>
      <img src="https://picsum.photos/seed/constructionpage/600/400" alt="Under Construction" className="mt-8 rounded-lg mx-auto shadow-lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-gray-100 flex">
      <nav className="w-20 xl:w-72 border-r border-gray-700 p-2 xl:p-4 flex flex-col justify-between fixed top-0 left-0 h-full">
        <div>
          <Link to="/" className="text-blue-500 p-3 block mb-4">
            <ICONS.POST className="w-8 h-8 mx-auto xl:mx-0" />
          </Link>
          <div className="space-y-2">
            <NavLink to={ActiveView.Home} icon={<ICONS.HOME />} label="Home" />
            <NavLink to={ActiveView.Explore} icon={<ICONS.EXPLORE />} label="Explore" />
            <NavLink to={ActiveView.Notifications} icon={<ICONS.NOTIFICATIONS />} label="Notifications" />
            <NavLink to={ActiveView.Messages} icon={<ICONS.MESSAGES />} label="Messages" />
            <NavLink to={ActiveView.Bookmarks} icon={<ICONS.BOOKMARKS />} label="Bookmarks" />
            <NavLink to={ActiveView.Profile} icon={<ICONS.PROFILE />} label="Profile" />
          </div>
           <button 
            onClick={() => {
              const content = prompt("Enter post content (or leave blank for AI suggestion):");
              if (content === null) return;
              if (content.trim() === "") {
                generatePostSuggestion().then(suggestion => {
                  if (!suggestion.startsWith("Error:")) {
                    handleAddPost(suggestion); // Normal user post
                  } else {
                    alert(suggestion);
                  }
                });
              } else {
                handleAddPost(content);
              }
            }}
            className="mt-6 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-3 xl:px-6 rounded-full w-full text-lg hidden xl:block"
          >
            Post
          </button>
           <button  
            onClick={() => { 
              const content = prompt("Enter post content (or leave blank for AI suggestion):");
              if (content === null) return;
              if (content.trim() === "") {
                generatePostSuggestion().then(suggestion => {
                  if (!suggestion.startsWith("Error:")) handleAddPost(suggestion); else alert(suggestion);
                });
              } else {
                handleAddPost(content);
              }
            }}
            className="mt-6 bg-blue-500 hover:bg-blue-600 text-white font-bold p-3 rounded-full w-14 h-14 flex items-center justify-center xl:hidden mx-auto">
            <ICONS.POST className="w-6 h-6" />
          </button>
        </div>
        {currentUserProfile && (
          <div className="mt-auto p-1 group cursor-pointer" onClick={handleLogout} title={`Logout @${currentUserProfile.actualUsername}`} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && handleLogout()} aria-label={`Logout ${currentUserProfile.displayName}`}>
            <div className="flex items-center space-x-3 group-hover:bg-gray-800 p-2 rounded-full transition-colors">
              <img src={currentUserProfile.avatarUrl || DEFAULT_USER_AVATAR} alt={currentUserProfile.displayName} className="w-10 h-10 rounded-full" />
              <div className="hidden xl:flex flex-1 items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-100">{currentUserProfile.displayName}</p>
                  <p className="text-gray-500 text-xs">@{currentUserProfile.actualUsername}</p>
                </div>
                <ICONS.LOGOUT className="w-5 h-5 text-gray-400 group-hover:text-gray-200" />
              </div>
              <div className="xl:hidden flex-1 flex justify-end">
                <ICONS.LOGOUT className="w-6 h-6 text-gray-400 group-hover:text-gray-200" />
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 ml-20 xl:ml-72 border-r border-gray-700 min-h-screen">
        <header className="sticky top-0 bg-black/80 backdrop-blur-md z-10 p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-gray-100">{activeView}</h1>
        </header>
        <Routes>
          <Route path="/" element={
            <>
              <CreatePostForm currentUser={currentUserProfile} onAddPost={handleAddPost} />
              {isLoadingPosts && <div className="p-4 text-center text-gray-400">Loading posts... <span className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span></div>}
              {!isLoadingPosts && posts.length === 0 && <p className="p-4 text-center text-gray-500">No posts yet. Be the first to post!</p>}
              {posts.map((post) => (
                <PostItem key={post.id} post={post} currentUser={currentUserProfile} onToggleLike={handleToggleLike} onComment={openCommentModal} />
              ))}
            </>
          } />
          <Route path="/explore" element={<PlaceholderPage title="Explore" />} />
          <Route path="/notifications" element={<PlaceholderPage title="Notifications" />} />
          <Route path="/messages" element={<PlaceholderPage title="Messages" />} />
          <Route path="/bookmarks" element={<PlaceholderPage title="Bookmarks" />} />
          <Route path="/profile" element={
            <div className="p-4">
              {currentUserProfile ? (
                <>
                  <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
                    <img src={currentUserProfile.avatarUrl || DEFAULT_USER_AVATAR} alt={currentUserProfile.displayName} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-500" />
                    <h2 className="text-2xl font-bold text-center text-gray-100">{currentUserProfile.displayName}</h2>
                    <p className="text-center text-gray-400">@{currentUserProfile.actualUsername}</p>
                    <p className="text-center text-gray-500 mt-2">Email: {currentUserProfile.email}</p>
                    <p className="text-center text-gray-500 mt-1">User ID: {currentUserProfile.id}</p>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">Your Posts</h3>
                  {isLoadingPosts && <div className="p-4 text-center text-gray-400">Loading your posts...</div>}
                  {!isLoadingPosts && posts.filter(p => p.user.id === currentUserProfile.id).length === 0 && <p className="text-gray-500">You haven't posted anything yet.</p>}
                  {posts.filter(p => p.user.id === currentUserProfile.id).map(post => (
                    <PostItem key={post.id} post={post} currentUser={currentUserProfile} onToggleLike={handleToggleLike} onComment={openCommentModal} />
                  ))}
                </>
              ) : (
                <p className="text-center text-gray-400">Loading profile...</p>
              )}
            </div>
          } />
        </Routes>
      </main>

      <aside className="w-96 p-4 hidden lg:block sticky top-0 h-screen overflow-y-auto scrollbar-hide">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h2 className="text-xl font-bold text-gray-100 mb-4">Trends for you</h2>
          <ul className="space-y-3">
            {['#Nhost', '#HasuraGraphQL', '#ReactDev', '#GeminiAPI', '#Serverless'].map(trend => (
              <li key={trend} className="hover:bg-gray-700/50 p-2 rounded-md cursor-pointer">
                <p className="font-semibold text-gray-300">{trend}</p>
                <p className="text-xs text-gray-500">Trending in Tech</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 mt-6">
          <h2 className="text-xl font-bold text-gray-100 mb-4">Meet Our Bot Personas</h2>
          <ul className="space-y-3">
            {BOT_PROFILES.map(bot => (
              <li key={bot.actualUsername} className="flex items-center space-x-3 p-2 hover:bg-gray-700/50 rounded-md">
                <img src={bot.avatarUrl} alt={bot.displayName || 'Bot'} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-semibold text-gray-200">{bot.displayName || 'Bot'} <ICONS.BOT className="w-4 h-4 inline-block text-blue-400 ml-1" /></p>
                  <p className="text-xs text-gray-500">@{bot.actualUsername || 'botuser'}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {activeModalPost && currentUserProfile && (
        <CommentViewModal
          post={activeModalPost}
          currentUser={currentUserProfile}
          onClose={closeCommentModal}
          onAddComment={handleAddComment}
          onToggleLike={handleToggleLike}
        />
      )}
    </div>
  );
};

export default App;
