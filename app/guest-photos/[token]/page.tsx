"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart, Camera, User, Upload, Check, AlertTriangle, Loader2, Download } from "lucide-react"

export default function GuestPhotosPage() {
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null) // For image preview
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null)
  const [progressPercent, setProgressPercent] = useState<number | null>(null)

  // This state will be used when fetching actual photos later
  const [photosReady, setPhotosReady] = useState(false)
  const [guestPhotos, setGuestPhotos] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentGuestId, setCurrentGuestId] = useState<string | null>(null) // Added for SSE

  const fileInputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null) // Added for SSE
  const params = useParams()
  const token = params?.token as string | undefined
  const router = useRouter()

  const authenticateGuest = async () => {
    if (!token) {
      console.log('[GuestPhotos] No token available for authentication');
      return false;
    }
    
    console.log('[GuestPhotos] Attempting guest login with token:', token);
    try {
      const response = await fetch('/api/auth/guest-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
        credentials: 'include', // Important: This ensures cookies are sent/received
      });
      
      const result = await response.json();
      console.log('[GuestPhotos] Guest login response:', result);
      
      if (response.ok) {
        console.log('[GuestPhotos] Guest login successful');
        setIsAuthenticated(true);
        return true;
      }
      console.log('[GuestPhotos] Guest login failed:', response.status);
      return false;
    } catch (error) {
      console.error('[GuestPhotos] Authentication error:', error);
      return false;
    }
  };

  const fetchGuestPhotos = async () => {
    if (!isAuthenticated) {
      const authSuccess = await authenticateGuest();
      if (!authSuccess) {
        setUploadStatusMessage("שגיאה באימות. אנא נסו שוב או פנו לתמיכה.");
        return;
      }
    }

    setIsLoadingPhotos(true);
    try {
      const response = await fetch('/api/photos/my-photos');
      const data = await response.json();
      
      if (response.ok && data.photos) {
        setGuestPhotos(data.photos.map((photo: any) => photo.imageUrl));
        setPhotosReady(true);
      } else {
        setUploadStatusMessage(data.message || "לא נמצאו תמונות כרגע. נסו לרענן מאוחר יותר.");
        setPhotosReady(false);
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
      setUploadStatusMessage("אירעה שגיאה בטעינת התמונות. אנא נסו שוב מאוחר יותר.");
      setPhotosReady(false);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setUploadStatusMessage("שגיאה: לא זוהה טוקן הזמנה. אנא השתמשו בקישור שקיבלתם בהזמנה.")
    } else {
      authenticateGuest(); // Authenticate initially if token exists
    }

    // Cleanup EventSource on component unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('[GuestPhotos] Closing EventSource connection on unmount');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token]) // Added eventSourceRef to dependency array, though it's a ref. Main trigger is token.

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setUploadStatusMessage(null); // Clear previous messages on new file select
    }
  };

  const handleSelfieSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!fileInputRef.current?.files?.length || !fileInputRef.current.files[0]) {
      setUploadStatusMessage("אנא בחרו קובץ תמונה להעלאה.")
      return
    }
    const file = fileInputRef.current.files[0]

    if (!token) {
      setUploadStatusMessage("שגיאה: טוקן הזמנה חסר. אנא השתמשו בקישור המקורי.")
      return
    }

    setIsUploading(true)
    setUploadStatusMessage("מעלה את הסלפי שלך...")
    setUploadSuccess(false)
    setProcessingProgress(null)
    setProgressPercent(null)
    setGuestPhotos([]) // Clear previous photos
    setPhotosReady(false) // Reset photos ready state

    // Close any existing EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const formData = new FormData()
    formData.append('selfie', file)
    formData.append('token', token)

    try {
      const response = await fetch('/api/photos/upload-selfie', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      const result = await response.json()
      console.log('[GuestPhotos] Selfie upload response:', result)

      if (response.ok && result.faceDetected && result.guestId) {
        setUploadStatusMessage("סלפי הועלה בהצלחה! מתחבר לעדכוני עיבוד תמונות...")
        setUploadSuccess(true) // Indicates selfie upload was successful
        setCurrentGuestId(result.guestId); // Store guestId

        // Initialize EventSource
        const es = new EventSource(`/api/photos/guest-photo-stream?guestId=${result.guestId}`);
        eventSourceRef.current = es;

        es.onopen = () => {
          console.log('[GuestPhotos] SSE Connection Opened');
          setUploadStatusMessage("מחובר לעדכונים... ממתין לתחילת עיבוד.");
          // setIsUploading remains true
        };

        es.addEventListener('photoProcessed', (event) => {
          const data = JSON.parse(event.data);
          console.log('[GuestPhotos] SSE photoProcessed:', data);

          setProcessingProgress({ current: data.progress.current, total: data.progress.total });
          const percent = Math.round((data.progress.current / data.progress.total) * 100);
          setProgressPercent(percent);
          setUploadStatusMessage(`מעבד תמונות... ${data.progress.current}/${data.progress.total} (${percent}%)`);

          if (data.isMatch && data.photoUrl) {
            setGuestPhotos(prevPhotos => {
              // Avoid duplicates if backend might send them
              if (!prevPhotos.includes(data.photoUrl)) {
                return [...prevPhotos, data.photoUrl];
              }
              return prevPhotos;
            });
          }
          if (data.error) {
            console.warn(`[GuestPhotos] Error processing photo ${data.photoId}: ${data.error}`);
            // Optionally, display this specific error to the user or add to a list of errors
          }
        });

        es.addEventListener('processingComplete', (event) => {
          const data = JSON.parse(event.data);
          console.log('[GuestPhotos] SSE processingComplete:', data);
          setUploadStatusMessage(guestPhotos.length > 0 ? "העיבוד הושלם! מציג את התמונות שלך." : "העיבוד הושלם, אך לא נמצאו תמונות תואמות.");
          setPhotosReady(true); // Even if no photos, processing is done.
          setIsUploading(false); // Processing finished
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        });

        es.addEventListener('processingError', (event) => {
          const data = JSON.parse(event.data);
          console.error('[GuestPhotos] SSE processingError:', data);
          setUploadStatusMessage(`אירעה שגיאה כללית בעיבוד: ${data.error}. נסו שוב.`);
          setIsUploading(false);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        });

        es.onerror = (error) => {
          console.error('[GuestPhotos] SSE Error:', error);
          setUploadStatusMessage("החיבור לעדכוני התמונות אבד. אנא נסו להעלות את הסלפי שוב.");
          setIsUploading(false);
          if (eventSourceRef.current) {
            eventSourceRef.current.close(); // Ensure it's closed
            eventSourceRef.current = null;
          }
        };

      } else {
        setUploadStatusMessage(result.message || "העלאת הסלפי נכשלה או שלא זוהו פנים. אנא נסו שוב.");
        setUploadSuccess(false);
        setIsUploading(false); // Selfie upload failed, stop uploading state
      }
    } catch (error) {
      console.error("[GuestPhotos] Error in handleSelfieSubmit:", error);
      setUploadStatusMessage("אירעה שגיאה בהעלאת הסלפי. אנא נסו שוב.");
      setUploadSuccess(false);
      setIsUploading(false);
    } finally {
      // setIsUploading is now managed by SSE events or direct failure
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear file input
      }
    }
  }

  // --- Mock photo display logic (remains the same) ---
   const togglePhotoSelection = (photo: string) => {
    setSelectedPhotos((prev) => (prev.includes(photo) ? prev.filter((p) => p !== photo) : [...prev, photo]))
  }

  const downloadSelected = () => {
    alert(`מדמה הורדה של ${selectedPhotos.length} תמונות נבחרות...`)
  }
  // --- End mock photo display logic ---


  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 py-8" dir="rtl">
      <header className="container mx-auto px-4 text-center mb-10">
        <Heart className="h-16 w-16 text-pink-500 mx-auto mb-4 animate-pulse" />
        <h1 className="text-4xl font-bold text-gray-800 mb-2">העלאת סלפי וצפייה בתמונות</h1>
        <p className="text-lg text-gray-600">ברוכים הבאים לאזור התמונות האישי שלכם מהחתונה של [שם החתן] ו[שם הכלה]!</p>
      </header>

      <main className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {!photosReady ? (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-center text-2xl">
                  <User className="h-7 w-7 ml-3 text-pink-500" />
                  שלב 1: העלאת תמונת סלפי
                </CardTitle>
                <CardDescription className="text-center mt-2">
                  כדי שנוכל למצוא את התמונות שלכם מהאירוע, אנא העלו תמונת סלפי ברורה ועדכנית שלכם.
                  הפנים שלכם צריכות להיות גלויות היטב.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSelfieSubmit} className="space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-pink-400 transition-colors">
                    {profileImagePreview ? (
                      <div className="mb-4">
                        <img src={profileImagePreview} alt="תצוגה מקדימה של סלפי" className="w-40 h-40 rounded-full object-cover mx-auto border-4 border-pink-200 shadow-sm" />
                      </div>
                    ) : (
                      <Camera className="h-20 w-20 mx-auto mb-3 text-gray-400" />
                    )}
                    <label htmlFor="selfieInput" className="cursor-pointer text-pink-600 hover:text-pink-700 font-medium">
                      {profileImagePreview ? "בחרו תמונה אחרת" : "בחרו קובץ תמונה"}
                    </label>
                    <input
                      id="selfieInput"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <p className="text-xs text-gray-500 mt-1">תומך ב-JPG, PNG. גודל מקסימלי 5MB.</p>
                  </div>

                  <Button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white" disabled={isUploading || !profileImagePreview || !token}>
                    {isUploading ? (
                      <><Loader2 className="h-5 w-5 ml-2 animate-spin" />מעלה ומעבד...</>
                    ) : (
                      <><Upload className="h-5 w-5 ml-2" />העלה סלפי ובדוק התאמות</>
                    )}
                  </Button>
                </form>
                {uploadStatusMessage && (
                  <div className={`text-center p-4 rounded-lg ${
                    uploadSuccess ? 'bg-green-50 text-green-700' : 
                    isUploading ? 'bg-blue-50 text-blue-700' : 
                    'bg-red-50 text-red-700'
                  }`}>
                    <p>{uploadStatusMessage}</p>
                    {processingProgress && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-pink-500 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${progressPercent ?? 0}%` }}
                          ></div>
                        </div>
                        <p className="text-sm mt-1">
                          {processingProgress.current} מתוך {processingProgress.total} תמונות
                          {progressPercent !== null && ` (${progressPercent}%)`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500 space-y-1 text-center mt-4 p-3 bg-gray-50 rounded-md">
                  <p><strong>כיצד זה עובד?</strong></p>
                  <p>1. העלו סלפי ברור שלכם.</p>
                  <p>2. המערכת שלנו תנתח את תווי הפנים שלכם (באופן מאובטח ופרטי).</p>
                  <p>3. לאחר מכן, נסרוק את מאגר תמונות החתונה ונציג לכם את התמונות בהן אתם מופיעים.</p>
                  <p>המידע שלכם נשמר באופן מאובטח ולא ישותף עם גורמים חיצוניים.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center text-2xl">
                        <Check className="h-7 w-7 ml-3 text-green-500" />
                        {guestPhotos.length > 0 ? "מצאנו תמונות שלך!" : "לא נמצאו תמונות"}
                    </CardTitle>
                    <CardDescription className="text-center mt-2">
                        {guestPhotos.length > 0 
                          ? "אלו התמונות מהחתונה שבהן זוהית. לחצו על תמונה כדי לבחור אותה להורדה."
                          : "לא נמצאו תמונות שבהן זוהית כרגע. נסו לרענן מאוחר יותר."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingPhotos ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                            <span className="mr-2">טוען תמונות...</span>
                        </div>
                    ) : guestPhotos.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                {guestPhotos.map((photo, index) => (
                                <div
                                    key={index}
                                    className={`relative cursor-pointer rounded-lg overflow-hidden transition-all aspect-square group ${
                                    selectedPhotos.includes(photo)
                                        ? "ring-4 ring-pink-500 ring-offset-2"
                                        : "hover:ring-2 hover:ring-pink-300"
                                    }`}
                                    onClick={() => togglePhotoSelection(photo)}
                                >
                                    <img
                                    src={photo}
                                    alt={`תמונת חתונה ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    />
                                    {selectedPhotos.includes(photo) && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                        <Check className="h-10 w-10 text-white" />
                                    </div>
                                    )}
                                     <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-30 text-white p-1 text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        בחר/בטל בחירה
                                    </div>
                                </div>
                                ))}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button variant="outline" onClick={downloadSelected} disabled={selectedPhotos.length === 0}>
                                    <Download className="h-4 w-4 ml-2" />
                                    הורד נבחרות ({selectedPhotos.length})
                                </Button>
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-gray-600">לא נמצאו תמונות כרגע. נסו לרענן מאוחר יותר.</p>
                    )}
                </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
