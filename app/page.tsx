import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart, Camera, Users, Calendar } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50" dir="rtl">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Heart className="h-8 w-8 text-pink-500" />
            <span className="text-2xl font-bold text-gray-800">חתונה שלי</span>
          </div>
          <div className="space-x-4 space-x-reverse">
            <Link href="/login">
              <Button variant="outline">התחברות</Button>
            </Link>
            <Link href="/register">
              <Button>התחל עכשיו</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            החתונה המושלמת שלכם, <span className="text-pink-500">בשיתוף מרגש</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            צרו הזמנות מהממות, נהלו אישורי הגעה ושתפו זכרונות יקרים עם זיהוי פנים חכם
          </p>
          <Link href="/register">
            <Button size="lg" className="text-lg px-8 py-3">
              התחילו לתכנן את החתונה שלכם
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">כל מה שאתם צריכים ליום המיוחד שלכם</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Calendar className="h-12 w-12 text-pink-500 mb-4" />
                <CardTitle>הזמנות מהממות</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>צרו הזמנות חתונה מרהיבות עם התבניות שלנו או העלו עיצוב משלכם</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-12 w-12 text-purple-500 mb-4" />
                <CardTitle>מערכת אישור הגעה חכמה</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>אספו מידע מפורט על האורחים כולל העדפות תזונה וצרכי הסעה</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Camera className="h-12 w-12 text-blue-500 mb-4" />
                <CardTitle>שיתוף תמונות חכם</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>העלו תמונות חתונה ותנו לבינה מלאכותית לזהות ולשתף תמונות עם כל אורח</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Heart className="h-12 w-12 text-red-500 mb-4" />
                <CardTitle>שימור זכרונות</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>שמרו את כל זכרונות החתונה במקום אחד ושתפו אותם בקלות עם יקיריכם</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2024 חתונה שלי. הופכים את היום המיוחד שלכם למיוחד עוד יותר.</p>
        </div>
      </footer>
    </div>
  )
}
