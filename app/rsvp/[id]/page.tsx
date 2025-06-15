"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Heart, Calendar, MapPin, Clock, User, Mail, Phone } from "lucide-react"

export default function RSVPPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    attendance: "",
    guestCount: "1",
    specialDishes: [],
    transportation: "",
    transportationCity: "",
    message: "",
  })

  // Mock wedding data - in real app this would come from the invitation ID
  const weddingData = {
    coupleName: "שרה ויוחנן",
    eventName: "חתונת שרה ויוחנן",
    date: "2024-08-15",
    time: "19:00",
    location: "אולמי גן עדן",
    city: "תל אביב",
    askSpecialDishes: true,
    dishOptions: ["מנה רגילה", "מנת ילדים", "צמחוני", "ללא גלוטן", "טבעוני", "כשר"],
    askTransportation: true,
    transportationCity: "ירושלים",
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("RSVP submitted:", formData)
    alert("תודה על אישור ההגעה! התגובה שלכם נרשמה.")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-6 text-center">
          <Heart className="h-12 w-12 text-pink-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{weddingData.eventName}</h1>
          <p className="text-gray-600">אתם מוזמנים לחגוג עם {weddingData.coupleName}</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Wedding Details */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-center">פרטי החתונה</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 space-x-reverse text-gray-600">
                <Calendar className="h-5 w-5" />
                <span className="text-lg">{weddingData.date}</span>
                <Clock className="h-5 w-5 mr-4" />
                <span className="text-lg">{weddingData.time}</span>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse text-gray-600">
                <MapPin className="h-5 w-5" />
                <span className="text-lg">
                  {weddingData.location}, {weddingData.city}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* RSVP Form */}
          <Card>
            <CardHeader>
              <CardTitle>אישור הגעה</CardTitle>
              <CardDescription>אנא הודיעו לנו אם תצטרפו אלינו</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">הפרטים שלכם</h3>

                  <div className="space-y-2">
                    <Label htmlFor="name">שם מלא *</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">אימייל *</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">מספר טלפון</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pr-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Attendance */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">הגעה</h3>
                  <RadioGroup
                    value={formData.attendance}
                    onValueChange={(value) => setFormData({ ...formData, attendance: value })}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="yes" id="attend-yes" />
                      <Label htmlFor="attend-yes">כן, אני אגיע! 🎉</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="no" id="attend-no" />
                      <Label htmlFor="attend-no">מצטער, לא אוכל להגיע 😢</Label>
                    </div>
                  </RadioGroup>

                  {formData.attendance === "yes" && (
                    <div className="space-y-2">
                      <Label htmlFor="guestCount">מספר אורחים</Label>
                      <Select
                        value={formData.guestCount}
                        onValueChange={(value) => setFormData({ ...formData, guestCount: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">אורח 1</SelectItem>
                          <SelectItem value="2">2 אורחים</SelectItem>
                          <SelectItem value="3">3 אורחים</SelectItem>
                          <SelectItem value="4">4 אורחים</SelectItem>
                          <SelectItem value="5">5+ אורחים</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Special Dishes */}
                {formData.attendance === "yes" && weddingData.askSpecialDishes && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">העדפות תזונה</h3>
                    <p className="text-sm text-gray-600">אנא בחרו כל דרישה תזונתית:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {weddingData.dishOptions.map((dish) => (
                        <div key={dish} className="flex items-center space-x-2 space-x-reverse">
                          <Checkbox
                            id={dish}
                            checked={formData.specialDishes.includes(dish)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  specialDishes: [...formData.specialDishes, dish],
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  specialDishes: formData.specialDishes.filter((d) => d !== dish),
                                })
                              }
                            }}
                          />
                          <Label htmlFor={dish} className="text-sm">
                            {dish}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transportation */}
                {formData.attendance === "yes" && weddingData.askTransportation && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">הסעות</h3>
                    <p className="text-sm text-gray-600">
                      אנחנו מארגנים הסעות מ{weddingData.transportationCity}. האם תרצו להצטרף?
                    </p>
                    <RadioGroup
                      value={formData.transportation}
                      onValueChange={(value) => setFormData({ ...formData, transportation: value })}
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="yes" id="transport-yes" />
                        <Label htmlFor="transport-yes">כן, אני צריך הסעה</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="no" id="transport-no" />
                        <Label htmlFor="transport-no">לא, אני אארגן הסעה בעצמי</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">הודעה מיוחדת (אופציונלי)</Label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-md resize-none"
                    rows={3}
                    placeholder="שתפו את ההתרגשות שלכם או הערות מיוחדות..."
                  />
                </div>

                <Button type="submit" className="w-full" size="lg">
                  שלחו אישור הגעה
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
