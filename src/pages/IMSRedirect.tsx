import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * IMS Integration redirect page.
 * Accepts query params: ?plant=1300&mrb_number=MRB-2024-0001&embed=true
 * Deep-links into the MRB system from an external IMS.
 */
const IMSRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const mrbNumber = searchParams.get('mrb_number');
  const embed = searchParams.get('embed') === 'true';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Redirect to login with return URL
      const returnUrl = `/ims-redirect?${searchParams.toString()}`;
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (mrbNumber) {
      // Navigate to worklist with search pre-filled
      const targetUrl = embed ? `/worklist?search=${mrbNumber}&embed=true` : `/worklist?search=${mrbNumber}`;
      navigate(targetUrl, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, mrbNumber, embed, navigate, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to MRB System...</p>
      </div>
    </div>
  );
};

export default IMSRedirect;
