"use client"

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, CameraOff, Heart, LogOut, AlertTriangle, CheckCircle } from "lucide-react";

interface Photo {
  _id: string;
  imageUrl: string;
  cloudinaryPublicId: string;
  createdAt: string;
  // detectedFaces might not be directly used here but good to have for potential future use
}

export default function MyPhotosPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null); // For non-error messages like "no photos found"

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?message=Please log in to view your photos.');
    } else if (user && user.userType !== 'guest') {
      setError("This page is exclusively for guests. Please log in with a guest account or contact support if you believe this is an error.");
      setPhotos([]);
      setIsLoadingPhotos(false);
    } else if (user) {
      fetchUserPhotos();
    }
  }, [user, authLoading, router]);

  const fetchUserPhotos = async () => {
    setIsLoadingPhotos(true);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch('/api/photos/my-photos');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) { // Unauthorized or token issue
             router.push('/login?message=Session expired. Please log in again.');
             return;
        }
        // X-No-Photos is a custom header I decided to use in the API
        if (response.headers.get('X-No-Photos') === 'true' || (data.photos && data.photos.length === 0)) {
            setInfoMessage(data.message || "No photos featuring you have been found yet. This could be because you haven't uploaded a selfie, your selfie couldn't be matched, or photos haven't been processed. Please check back later or ensure your selfie is clear.");
            setPhotos([]);
        } else {
            throw new Error(data.message || `Failed to fetch photos: ${response.statusText}`);
        }
      } else {
        if (data.photos && data.photos.length > 0) {
            setPhotos(data.photos);
            setInfoMessage(`We found ${data.photos.length} photo(s) of you! Enjoy!`);
        } else {
            setInfoMessage("No photos found featuring you at the moment. Please check back later!");
            setPhotos([]);
        }
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
      setError(err.message || "An unexpected error occurred while fetching your photos. Please try refreshing the page.");
      setPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleDownload = async (photoUrl: string, publicId: string) => {
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();

      const fileNameFromUrl = photoUrl.substring(photoUrl.lastIndexOf('/') + 1);
      // Try to get a more descriptive name, fallback to publicId or generic name
      const namePart = publicId.split('/').pop() || fileNameFromUrl.split('.')[0] || `wedding_photo_${Date.now()}`;
      const extension = fileNameFromUrl.split('.').pop() || 'jpg'; // Guess extension if not in URL
      const fileName = `${namePart}.${extension}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Download failed:', e);
      alert('הורדת התמונה נכשלה. אנא נסו שוב.');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login?message=You have been logged out.');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 p-6 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
        <p className="mt-4 text-xl text-gray-700">טוען את המידע שלך...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 py-8" dir="rtl">
      <header className="container mx-auto px-4 mb-10">
        <div className="bg-white shadow-lg rounded-xl p-6 flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 space-x-reverse mb-4 sm:mb-0">
            <Heart className="h-10 w-10 text-pink-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">התמונות שלי מהחתונה</h1>
              {user && <p className="text-md text-gray-600">שלום, {user.name}! כאן תוכלו למצוא את כל התמונות שלכם מהאירוע.</p>}
            </div>
          </div>
          {user && (
            <Button variant="outline" size="lg" onClick={handleLogout} className="border-pink-500 text-pink-500 hover:bg-pink-50 hover:text-pink-600">
              <LogOut className="h-5 w-5 ml-2" />
              התנתקות
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4">
        {isLoadingPhotos && !error && !infoMessage && (
             <div className="flex flex-col items-center justify-center text-center p-10">
                <Loader2 className="h-12 w-12 animate-spin text-pink-500 mb-4" />
                <p className="text-lg text-gray-700">מחפש את התמונות שלכם במאגר...</p>
                <p className="text-sm text-gray-500">זה עשוי לקחת מספר רגעים.</p>
            </div>
        )}

        {error && (
          <Card className="mb-8 bg-red-50 border-red-500 shadow-lg">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center"><AlertTriangle className="h-6 w-6 ml-2"/>אירעה שגיאה</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error}</p>
              <Button onClick={fetchUserPhotos} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
                <Loader2 className="h-4 w-4 ml-2 animate-spin hidden" /> נסה שוב
              </Button>
            </CardContent>
          </Card>
        )}

        {infoMessage && !error && (
            <Card className={`text-center py-10 shadow-lg ${photos.length === 0 ? 'bg-blue-50 border-blue-500' : 'bg-green-50 border-green-500'}`}>
                 <CardHeader>
                    {photos.length === 0 ?
                        <CameraOff className="h-16 w-16 mx-auto text-blue-400 mb-4" /> :
                        <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    }
                    <CardTitle className={photos.length === 0 ? 'text-blue-700' : 'text-green-700'}>
                        {photos.length > 0 ? "סטטוס תמונות" : "עדיין אין תמונות"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700 text-lg">{infoMessage}</p>
                    {photos.length === 0 &&
                        <p className="text-sm text-gray-500 mt-2">
                            אם העליתם סלפי לאחרונה, אנא המתינו בסבלנות לעיבוד התמונות.
                        </p>
                    }
                    <Button onClick={fetchUserPhotos} className="mt-6 bg-pink-500 hover:bg-pink-600 text-white">
                        <Loader2 className="h-4 w-4 ml-2 animate-spin hidden" /> רענן
                    </Button>
                </CardContent>
            </Card>
        )}

        {!isLoadingPhotos && !error && photos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
            {photos.map((photo) => (
              <Card key={photo._id} className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 group rounded-lg flex flex-col">
                <div className="relative aspect-[3/4] w-full"> {/* Aspect ratio for portrait-like images */}
                  <img
                    src={photo.imageUrl}
                    alt={`תמונה מהחתונה ${photo._id}`}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    loading="lazy" // Lazy loading for images
                  />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <CardContent className="p-4 flex flex-col flex-grow justify-between bg-white">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      הועלה בתאריך: {new Date(photo.createdAt).toLocaleDateString('he-IL')}
                    </p>
                    {/* Could add more photo details here if needed */}
                  </div>
                  <Button
                    onClick={() => handleDownload(photo.imageUrl, photo.cloudinaryPublicId)}
                    className="w-full mt-3 bg-pink-500 hover:bg-pink-600 text-white transition-colors"
                    aria-label={`הורד תמונה ${photo._id}`}
                  >
                    <Download className="h-5 w-5 ml-2" />
                    הורדה
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
