"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heart, Calendar, Users, Camera, Settings, LogOut, Upload, Loader2, Mail, ListPlus, Send, Zap, User, Trash2, UserPlus, Phone, Download } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table"
import Image from "next/image"
import { FixedSizeGrid as Grid } from 'react-window'

interface MatchedPhoto {
    photoUrl: string;
    guestNames: string[];
    confidences: number[];
}

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()

  // State for wedding photo uploader
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [userPhotos, setUserPhotos] = useState<Array<{ imageUrl: string; cloudinaryPublicId: string; createdAt: string }>>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)

  // State for contact management
  const [contacts, setContacts] = useState<Array<{ name: string; phoneNumber: string; invitationSent: boolean; createdAt: string }>>([])
  const [newContact, setNewContact] = useState({ name: '', phoneNumber: '' })
  const [contactUploadMessage, setContactUploadMessage] = useState<string | null>(null)
  const [isUploadingContacts, setIsUploadingContacts] = useState(false)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [invitationSendMessage, setInvitationSendMessage] = useState<string | null>(null)
  const [isSendingInvitations, setIsSendingInvitations] = useState(false)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // State for batch photo notifications
  const [photoNotificationMessage, setPhotoNotificationMessage] = useState<string | null>(null)
  const [isSendingPhotoNotifications, setIsSendingPhotoNotifications] = useState(false)

  // State for triggering wedding photo processing
  const [processingPhotosMessage, setProcessingPhotosMessage] = useState<string | null>(null)
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false)
  const [matchedPhotos, setMatchedPhotos] = useState<MatchedPhoto[]>([])
  const [notMatchedPhotos, setNotMatchedPhotos] = useState<Array<{ photoUrl: string; detectedFaces: number; guestName: string; confidence: number }>>([])
  const [allPhotos, setAllPhotos] = useState<Array<{
    photoUrl: string;
    isProcessed: boolean;
    totalFacesDetected: number;
    matchedFaces: number;
    unmatchedFaces: number;
    status: string;
  }>>([])
  const [selectedTab, setSelectedTab] = useState('photos')

  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (user) {
      fetchUserPhotos()
      fetchUserContacts()
    }
  }, [user, isLoading, router])

  const fetchUserPhotos = async () => {
    setIsLoadingPhotos(true)
    try {
      const response = await fetch('/api/photos/user-photos')
      const data = await response.json()
      if (response.ok) {
        setUserPhotos(data.photos || [])
      } else {
        console.error('Error fetching photos:', data.message)
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setIsLoadingPhotos(false)
    }
  }

  const fetchUserContacts = async () => {
    setIsLoadingContacts(true)
    try {
      const response = await fetch('/api/contacts/user-contacts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      console.log('[Dashboard] /api/contacts/user-contacts response:', data)
      if (response.ok) {
        setContacts(data.contacts || [])
      } else {
        console.error('Error fetching contacts:', data.message)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setIsLoadingContacts(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files)
    setUploadMessage(null)
    setUploadedImageUrls([])
  }

  const handleSubmitWeddingPhotos = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFiles || selectedFiles.length === 0) {
      setUploadMessage("אנא בחרו קבצים להעלאה.")
      return
    }

    setUploading(true)
    setUploadMessage(`מעלה ${selectedFiles.length} קבצים...`)
    const formData = new FormData()
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i])
    }

    try {
      const response = await fetch('/api/photos/upload-wedding-photos', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (response.ok) {
        setUploadMessage(result.message || `${selectedFiles.length} קבצים הועלו בהצלחה!`)
        if (result.photos && Array.isArray(result.photos)) {
          setUploadedImageUrls(result.photos.map((p: any) => p.imageUrl))
          // Refresh the user's photos after successful upload
          fetchUserPhotos()
        }
      } else {
        setUploadMessage(result.message || "העלאת הקבצים נכשלה.")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadMessage("אירעה שגיאה במהלך ההעלאה.")
    } finally {
      setUploading(false)
      setSelectedFiles(null) // Clear selected files after upload
    }
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContact.name || !newContact.phoneNumber) {
      setContactUploadMessage("אנא מלאו את כל השדות")
      return
    }

    setIsAddingContact(true)
    setContactUploadMessage("מוסיף איש קשר...")
    try {
      const response = await fetch('/api/contacts/upload-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newContact]),
      })
      const result = await response.json()
      console.log('[Dashboard] /api/contacts/upload-list response:', result)
      if (response.ok) {
        setNewContact({ name: '', phoneNumber: '' })
        setContactUploadMessage("איש הקשר נוסף בהצלחה")
        // Refresh the contacts list
        fetchUserContacts()
      } else {
        setContactUploadMessage(result.message || "שגיאה בהוספת איש הקשר")
      }
    } catch (error) {
      console.error("Add contact error:", error)
      setContactUploadMessage("שגיאה בהוספת איש הקשר. אנא נסו שוב.")
    } finally {
      setIsAddingContact(false)
    }
  }

  const handleRemoveContact = async (index: number) => {
    const contactToRemove = contacts[index]
    try {
      const response = await fetch('/api/contacts/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: contactToRemove.phoneNumber }),
      })
      
      if (response.ok) {
        setContactUploadMessage("איש הקשר הוסר בהצלחה")
        // Refresh the contacts list
        fetchUserContacts()
      } else {
        const result = await response.json()
        setContactUploadMessage(result.message || "שגיאה בהסרת איש הקשר")
      }
    } catch (error) {
      console.error("Remove contact error:", error)
      setContactUploadMessage("שגיאה בהסרת איש הקשר. אנא נסו שוב.")
    }
  }

  const handleUploadContacts = async () => {
    if (contacts.length === 0) {
      setContactUploadMessage("אין אנשי קשר להעלאה")
      return
    }
    setIsUploadingContacts(true)
    setContactUploadMessage("מעלה רשימת אנשי קשר...")
    try {
      const response = await fetch('/api/contacts/upload-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contacts),
      })
      const result = await response.json()
      setContactUploadMessage(result.message || (response.ok ? "רשימת אנשי הקשר הועלתה בהצלחה." : "העלאת רשימת אנשי הקשר נכשלה."))
      if (response.ok) {
        // Refresh the contacts list
        fetchUserContacts()
      }
    } catch (error) {
      console.error("Contact upload error:", error)
      setContactUploadMessage("שגיאה בהעלאת אנשי הקשר. אנא נסו שוב.")
    } finally {
      setIsUploadingContacts(false)
    }
  }

  const handleSendInvitations = async () => {
    setIsSendingInvitations(true)
    setInvitationSendMessage("שולח הזמנות ראשוניות בוואטסאפ...")
    try {
      const response = await fetch('/api/contacts/send-invitations', {
        method: 'POST',
      })
      const result = await response.json()
      setInvitationSendMessage(result.message || (response.ok ? "תהליך שליחת ההזמנות החל." : "כישלון בתחילת תהליך שליחת ההזמנות."))
    } catch (error) {
      console.error("Send invitations error:", error)
      setInvitationSendMessage("אירעה שגיאה בניסיון לשלוח הזמנות.")
    } finally {
      setIsSendingInvitations(false)
    }
  }

  const handleNotifyGuestsForNewPhotos = async () => {
    setIsSendingPhotoNotifications(true);
    setPhotoNotificationMessage("שולח התראות על תמונות חדשות שזוהו...");
    try {
      const response = await fetch('/api/notifications/notify-guests-with-new-photos', {
        method: 'POST',
      });
      const result = await response.json();
      setPhotoNotificationMessage(result.message || (response.ok ? "תהליך שליחת ההתראות על תמונות חדשות הושלם." : "כישלון בשליחת התראות על תמונות חדשות."));
    } catch (error) {
      console.error("Photo match notification error:", error);
      setPhotoNotificationMessage("אירעה שגיאה במהלך שליחת התראות על תמונות חדשות.");
    } finally {
      setIsSendingPhotoNotifications(false);
    }
  };

  const fetchMatchedPhotos = async () => {
    try {
      const response = await fetch('/api/photos/matched-photos', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      console.log('[Dashboard] Matched Data:', data);
      if (data.matches) {
        setMatchedPhotos(data.matches);
        data.matches.forEach((match: MatchedPhoto) => {
          console.log('[Dashboard] Individual match data:', {
            photoUrl: match.photoUrl,
            guestNames: match.guestNames,
            confidences: match.confidences,
            calculatedPercentages: match.confidences.map(conf => Math.round(conf * 100))
          });
        });
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching matched photos:', error);
    }
  };

  const fetchNotMatchedPhotos = async () => {
    try {
      const response = await fetch('/api/photos/not-matched-photos', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      console.log('[Dashboard] Not Matched Data:', data);
      if (data.photos) {
        setNotMatchedPhotos(data.photos);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching not matched photos:', error);
    }
  };

  const fetchAllPhotos = async () => {
    try {
      const response = await fetch('/api/photos/all-photos', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      console.log('[Dashboard] All Photos Data:', data);
      if (data.photos) {
        setAllPhotos(data.photos);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching all photos:', error);
    }
  };

  const handleProcessWeddingPhotos = async () => {
    setIsProcessingPhotos(true);
    setProcessingPhotosMessage("מתחיל עיבוד תמונות חתונה וזיהוי פנים... זה עשוי לקחת זמן מה.");
    try {
      const response = await fetch('/api/photos/process-wedding-photos', {
        method: 'POST',
      });
      const result = await response.json();
      setProcessingPhotosMessage(result.message || (response.ok ? "עיבוד תמונות החתונה החל בהצלחה." : "כישלון בתחילת עיבוד תמונות החתונה."));

      if (response.ok) {
        await fetchMatchedPhotos();
        await fetchNotMatchedPhotos();
        await fetchAllPhotos();
      }
    } catch (error) {
      console.error("Wedding photo processing error:", error);
      setProcessingPhotosMessage("אירעה שגיאה בניסיון לעבד את תמונות החתונה.");
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  useEffect(() => {
    if (selectedTab === 'processing') {
      fetchMatchedPhotos();
      fetchNotMatchedPhotos();
      fetchAllPhotos();
    }
  }, [selectedTab]);

  const handleImageLoad = (imageUrl: string) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [imageUrl]: true
    }));
  };

  const PhotoGrid = ({ photos }: { photos: typeof userPhotos }) => {
    const columnCount = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 2;
    const rowCount = Math.ceil(photos.length / columnCount);
    const cellSize = Math.floor(window.innerWidth / columnCount);

    const Cell = ({ columnIndex, rowIndex, style }: any) => {
      const index = rowIndex * columnCount + columnIndex;
      if (index >= photos.length) return null;
      const photo = photos[index];

      return (
        <div style={style}>
          <div className="p-2">
            <div className={`relative aspect-square group ${imageLoadingStates[photo.imageUrl] ? 'opacity-100' : 'opacity-40'}`}>
              <img
                src={photo.imageUrl.split('/upload/').join('/upload/c_scale,w_400,f_auto,q_auto/')}
                alt={`תמונת חתונה ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
                onLoad={() => handleImageLoad(photo.imageUrl)}
              />
              {!imageLoadingStates[photo.imageUrl] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-white hover:bg-pink-500"
                  onClick={() => window.open(photo.imageUrl, '_blank')}
                >
                  <Download className="h-4 w-4 ml-2" />
                  הורד
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <Grid
        columnCount={columnCount}
        columnWidth={cellSize}
        height={Math.min(window.innerHeight * 0.8, rowCount * cellSize)}
        rowCount={rowCount}
        rowHeight={cellSize}
        width={window.innerWidth - 48}
      >
        {Cell}
      </Grid>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Heart className="h-8 w-8 text-pink-500" />
            <span className="text-2xl font-bold text-gray-800">חתונה שלי</span>
          </div>
          <div className="flex items-center space-x-4 space-x-reverse">
            <span className="text-gray-600">שלום, {user.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 ml-2" />
              התנתקות
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="photos" className="space-y-6" onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 text-xs sm:text-sm">
            <TabsTrigger value="rsvp">אישורי הגעה</TabsTrigger>
            <TabsTrigger value="invitation">הזמנה</TabsTrigger>
            <TabsTrigger value="photos">העלאת תמונות חתונה</TabsTrigger>
            <TabsTrigger value="processing">עיבוד תמונות חתונה</TabsTrigger>
            <TabsTrigger value="contacts">אנשי קשר והזמנות</TabsTrigger>
            <TabsTrigger value="settings">הגדרות</TabsTrigger>
          </TabsList>

          <TabsContent value="rsvp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Users className="h-5 w-5 ml-2" />תגובות אישור הגעה</CardTitle>
                <CardDescription>צפו ונהלו את תגובות האורחים להזמנת החתונה שלכם.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Placeholder for RSVP content */}
                <p>בקרוב...</p>
                <Link href="/rsvp-responses"><Button variant="link">צפו בכל התגובות (דמו)</Button></Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Calendar className="h-5 w-5 ml-2" />הזמנת החתונה</CardTitle>
                <CardDescription>צרו או העלו את הזמנת החתונה שלכם.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 {/* Placeholder for Invitation content */}
                <p>בקרוב...</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link href="/create-invitation"><Button className="w-full h-24 flex flex-col"><Calendar className="h-8 w-8 mb-2" />צרו הזמנה חדשה (דמו)</Button></Link>
                  <Link href="/upload-invitation"><Button variant="outline" className="w-full h-24 flex flex-col"><Calendar className="h-8 w-8 mb-2" />העלו עיצוב קיים (דמו)</Button></Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="photos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Camera className="h-5 w-5 ml-2" />העלאת תמונות חתונה</CardTitle>
                <CardDescription>
                    העלו כאן את כל תמונות החתונה שלכם. המערכת תנסה לזהות אורחים בתמונות לאחר שתפעילו את תהליך העיבוד בלשונית "עיבוד תמונות חתונה".
                    <br />
                    טיפ: העלו תמונות באיכות טובה. ניתן להעלות מספר קבצים בו זמנית.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <form onSubmit={handleSubmitWeddingPhotos} className="space-y-3 text-center">
                    <label htmlFor="weddingPhotoInput" className="block text-sm font-medium text-gray-700 mb-2">
                      בחרו קבצי תמונות (ניתן לבחור מספר קבצים):
                    </label>
                    <input
                      id="weddingPhotoInput" type="file" multiple onChange={handleFileChange}
                      className="block w-full max-w-md mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 cursor-pointer"
                      disabled={uploading}
                    />
                    <Button type="submit" disabled={uploading || !selectedFiles || selectedFiles.length === 0} className="mt-4">
                      {uploading ? (
                        <><Loader2 className="h-4 w-4 ml-2 animate-spin" />מעלה ({selectedFiles?.length || 0} קבצים)...</>
                      ) : (
                        <><Upload className="h-4 w-4 ml-2" />העלה {selectedFiles?.length ? `${selectedFiles.length} קבצים נבחרים` : 'קבצים נבחרים'}</>
                      )}
                    </Button>
                  </form>
                  {uploadMessage && (
                    <p className={`mt-3 text-sm font-medium ${uploadMessage.includes("נכשלה") || uploadMessage.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}>
                      {uploadMessage}
                    </p>
                  )}
                </div>
                {uploadedImageUrls.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">תצוגה מקדימה של תמונות שהועלו בבאצ' האחרון:</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {uploadedImageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden shadow">
                          <img src={url} alt={`Uploaded wedding photo preview ${index + 1}`} className="object-cover w-full h-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                 <div className="mt-4 text-sm text-gray-600">
                  <p>לאחר העלאת התמונות, יש להפעיל את תהליך עיבוד התמונות בלשונית "עיבוד תמונות חתונה" כדי לזהות אורחים.</p>
                </div>
              </CardContent>
            </Card>

            {/* Display uploaded photos */}
            <Card>
              <CardHeader>
                <CardTitle>התמונות שהועלו</CardTitle>
                <CardDescription>כל התמונות שהעליתם עד כה</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPhotos ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                  </div>
                ) : userPhotos.length > 0 ? (
                  <div className="grid grid-cols-1">
                    <PhotoGrid photos={userPhotos} />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    עדיין לא הועלו תמונות
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Camera className="h-5 w-5 ml-2" />תמונות שעובדו
                </CardTitle>
                <CardDescription>
                  כאן תוכלו לראות את תוצאות עיבוד התמונות וזיהוי הפנים.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matchedPhotos.map((photo, photoIndex) => (
                      <div key={photoIndex} className="relative group">
                        <div className="relative aspect-square overflow-hidden rounded-lg">
                          <Image
                            src={photo.photoUrl.split('/upload/').join('/upload/c_scale,w_400,f_auto,q_auto/')}
                            alt={`תמונה ${photoIndex + 1}`}
                            fill
                            className="object-cover"
                            loading="lazy"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                              <div className="space-y-1">
                                {photo.guestNames && photo.confidences && photo.guestNames.length > 0 ? (
                                  photo.guestNames.map((guest: string, guestIndex: number) => (
                                    <p key={guestIndex} className="font-medium text-sm text-white">
                                      {guest} ({Math.round(photo.confidences[guestIndex] * 100)}%)
                                    </p>
                                  ))
                                ) : (
                                  <p className="font-medium text-sm text-white">
                                    No match information
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Display the not matched photos */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">תמונות שלא זוהו:</h3>
                  {isLoadingPhotos ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {notMatchedPhotos.map((photo, index) => (
                        <Card key={index} className="overflow-hidden">
                          <div className="relative aspect-square w-32 h-32 mx-auto">
                            <img
                              src={photo.photoUrl.split('/upload/').join('/upload/c_scale,w_300,f_auto,q_auto/')}
                              alt={`תמונה ${index + 1}`}
                              className="object-cover w-full h-full"
                              loading="lazy"
                            />
                          </div>
                          <CardContent className="p-2">
                            <p className="font-medium text-sm">לא זוהה</p>
                            <p className="text-xs text-gray-500">
                              פנים שזוהו: {photo.detectedFaces}
                            </p>
                          </CardContent>      
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* New section for all photos */}
                <div className="mt-8">
                  <h2 className="text-2xl font-bold mb-4">סטטוס כל התמונות</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allPhotos.map((photo, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
                        <div className="aspect-w-16 aspect-h-9 mb-2">
                          <img
                            src={photo.photoUrl.split('/upload/').join('/upload/c_scale,w_400,f_auto,q_auto/')}
                            alt={`Photo ${index + 1}`}
                            className="object-cover rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold">סטטוס: {photo.status}</p>
                          <p>מעובד: {photo.isProcessed ? 'כן' : 'לא'}</p>
                          <p>מספר פנים שזוהו: {photo.totalFacesDetected}</p>
                          {photo.totalFacesDetected > 0 && (
                            <>
                              <p>פנים שזוהו בהתאמה: {photo.matchedFaces}</p>
                              <p>פנים שלא זוהו בהתאמה: {photo.unmatchedFaces}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                  {matchedPhotos.length === 0 && (
                    <p className="text-center text-gray-500">
                      לא נמצאו תמונות מזוהות עדיין. נסו להפעיל את תהליך העיבוד.
                    </p>
                  )}
                </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ניהול אנשי קשר</CardTitle>
                <CardDescription>הוסיפו או הסירו אנשי קשר מהרשימה</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddContact} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">שם</Label>
                      <Input
                        id="name"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        placeholder="הזן שם"
                        disabled={isAddingContact}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">מספר טלפון</Label>
                      <Input
                        id="phone"
                        value={newContact.phoneNumber}
                        onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                        placeholder="הזן מספר טלפון"
                        disabled={isAddingContact}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isAddingContact}>
                    {isAddingContact ? (
                      <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> מוסיף...</>
                    ) : (
                      <><UserPlus className="h-4 w-4 ml-2" /> הוסף איש קשר</>
                    )}
                  </Button>
                </form>

                {contactUploadMessage && (
                  <div className={`mt-4 text-sm ${contactUploadMessage.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}>
                    {contactUploadMessage}
                  </div>
                )}

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">רשימת אנשי הקשר שלך</h3>
                  {isLoadingContacts ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                    </div>
                  ) : contacts.length > 0 ? (
                    <div className="space-y-4">
                      {contacts.map((contact, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-sm text-gray-500">{contact.phoneNumber}</p>
                            <p className="text-xs text-gray-400">
                              {contact.invitationSent ? 'הזמנה נשלחה' : 'הזמנה לא נשלחה'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContact(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 ml-2" />
                            הסר
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      אין אנשי קשר ברשימה
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  <Button
                    onClick={handleSendInvitations}
                    className="w-full"
                    disabled={isSendingInvitations || contacts.length === 0}
                  >
                    {isSendingInvitations ? (
                      <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> שולח הזמנות...</>
                    ) : (
                      <><Mail className="h-4 w-4 ml-2" /> שלח הזמנות</>
                    )}
                  </Button>
                  {invitationSendMessage && (
                    <p className={`text-sm font-medium ${invitationSendMessage.includes("נכשל") ? "text-red-600" : "text-green-600"}`}>
                      {invitationSendMessage}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Settings className="h-5 w-5 ml-2" />הגדרות החתונה</CardTitle>
                <CardDescription>נהלו את פרטי החתונה וההעדפות שלכם.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 {/* Placeholder for Settings content */}
                <p>בקרוב...</p>
                <Button variant="outline" className="w-full justify-start">ערכו פרטי חתונה (דמו)</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
