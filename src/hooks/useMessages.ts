import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface OrgMessage {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  expires_at: string | null;
  created_at: string;
  sender_id: string;
  sender?: { full_name: string; avatar_url?: string };
  isRead?: boolean;
}

export function useMessages() {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<OrgMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!userProfile?.organization_id) {
      setLoading(false);
      return;
    }
    try {
      const { data: msgs } = await supabase
        .from('org_messages')
        .select('*, sender:sender_id(full_name, avatar_url)')
        .eq('organization_id', userProfile.organization_id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', userProfile.id);

      const readSet = new Set((reads || []).map((r: any) => r.message_id));
      const enriched = (msgs || []).map((m: any) => ({ ...m, isRead: readSet.has(m.id) }));
      setMessages(enriched);
      setUnreadCount(enriched.filter(m => !m.isRead).length);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!userProfile) return;
    await supabase.from('message_reads').upsert({
      message_id: messageId,
      user_id: userProfile.id,
    }, { onConflict: 'message_id,user_id' });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [userProfile]);

  const markAllAsRead = useCallback(async () => {
    if (!userProfile) return;
    const unread = messages.filter(m => !m.isRead);
    if (unread.length === 0) return;
    await supabase.from('message_reads').upsert(
      unread.map(m => ({ message_id: m.id, user_id: userProfile.id })),
      { onConflict: 'message_id,user_id' }
    );
    setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
    setUnreadCount(0);
  }, [messages, userProfile]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return { messages, unreadCount, loading, refetch: fetchMessages, markAsRead, markAllAsRead };
}
