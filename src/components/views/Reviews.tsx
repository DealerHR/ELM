import { useState, useEffect } from 'react';
import { Star, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Review {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_period: string;
  review_date: string;
  overall_rating?: number;
  status: string;
  comments?: string;
  created_at: string;
}

export default function Reviews() {
  const { userProfile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.id) {
      loadReviews();
    }
  }, [userProfile]);

  const loadReviews = async () => {
    try {
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userProfile?.id)
        .maybeSingle();

      if (!employeeData) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('performance_reviews')
        .select('*')
        .eq('employee_id', employeeData.id)
        .order('review_date', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Performance Reviews</h1>
        <p className="text-sm text-gray-600">Your performance evaluations</p>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    {review.review_period} Review
                  </h3>
                  <div className="flex items-center gap-2">
                    {renderStars(review.overall_rating)}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                      {review.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Calendar className="w-3 h-3" />
                {new Date(review.review_date).toLocaleDateString()}
              </div>
            </div>
            {review.comments && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">{review.comments}</p>
            )}
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-8">
          <Star className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No reviews yet</h3>
          <p className="text-sm text-gray-600">Your performance reviews will appear here</p>
        </div>
      )}
    </div>
  );
}
