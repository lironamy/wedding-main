"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Heart, Calendar, MapPin, Clock } from "lucide-react"

export default function CreateInvitationPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    language: "",
    eventNameHebrew: "",
    eventDate: "",
    eventTime: "",
    locationName: "",
    city: "",
    askSpecialDishes: "",
    specialDishes: [],
    askTransportation: "",
    transportationCity: "",
    selectedBackground: "",
  })

  const backgrounds = [
    { id: "floral", name: "פרחוני אלגנטי", preview: "/placeholder.svg?height=200&width=300" },
    { id: "classic", name: "זהב קלאסי", preview: "/placeholder.svg?height=200&width=300" },
    { id: "rustic", name: "גן כפרי", preview: "/placeholder.svg?height=200&width=300" },
    { id: "modern", name: "מינימליסטי מודרני", preview: "/placeholder.svg?height=200&width=300" },
    { id: "vintage", name: "רומנטיקה וינטג'", preview: "/placeholder.svg?height=200&width=300" },
    { id: "beach", name: "שקיעה בחוף", preview: "/placeholder.svg?height=200&width=300" },
  ]

  const dishOptions = ["מנה רגילה", "מנת ילדים", "צמחוני", "ללא גלוטן", "טבעוני", "כשר"]

  const handleNext = () => {
    if (step < 4) setStep(step + 1)
  }

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = () => {
    console.log("Invitation created:", formData)
    // Redirect to preview or dashboard
    window.location.href = "/dashboard"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 ml-2" />
              חזרה للوח הבקרה
            </Button>
          </Link>
          <div className="flex items-center space-x-2 space-x-reverse mr-4">
            <Heart className="h-6 w-6 text-pink-500" />
            <span className="text-xl font-bold">יצירת הזמנה</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i <= step ? "bg-pink-500 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Step 1: Background Selection */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>בחרו את הרקע להזמנה שלכם</CardTitle>
                <CardDescription>בחרו רקע יפה להזמנת החתונה שלכם</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {backgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className={`cursor-pointer border-2 rounded-lg p-2 transition-all ${
                        formData.selectedBackground === bg.id
                          ? "border-pink-500 bg-pink-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setFormData({ ...formData, selectedBackground: bg.id })}
                    >
                      <img
                        src={bg.preview || "/placeholder.svg"}
                        alt={bg.name}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <p className="text-sm font-medium text-center">{bg.name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Basic Event Details */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 ml-2" />
                  פרטי האירוע
                </CardTitle>
                <CardDescription>ספרו לנו על היום המיוחד שלכם</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">שפת האירוע</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData({ ...formData, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחרו שפה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hebrew">עברית</SelectItem>
                      <SelectItem value="english">אנגלית</SelectItem>
                      <SelectItem value="both">עברית ואנגלית</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventNameHebrew">שם האירוע (עברית)</Label>
                  <Input
                    id="eventNameHebrew"
                    value={formData.eventNameHebrew}
                    onChange={(e) => setFormData({ ...formData, eventNameHebrew: e.target.value })}
                    placeholder="שם האירוע"
                    dir="rtl"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">תאריך האירוע</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventTime">שעת האירוע</Label>
                    <Input
                      id="eventTime"
                      type="time"
                      value={formData.eventTime}
                      onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationName">שם מקום האירוع</Label>
                  <Input
                    id="locationName"
                    value={formData.locationName}
                    onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                    placeholder="למשל: אולמי גן עדן"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">עיר האירוע</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="למשל: תל אביב"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Special Requirements */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>דרישות מיוחדות</CardTitle>
                <CardDescription>הגדירו איזה מידע לאסוף מהאורחים</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium">מנות מיוחדות</Label>
                  <RadioGroup
                    value={formData.askSpecialDishes}
                    onValueChange={(value) => setFormData({ ...formData, askSpecialDishes: value })}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="no" id="dishes-no" />
                      <Label htmlFor="dishes-no">אין צורך לשאול</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="yes" id="dishes-yes" />
                      <Label htmlFor="dishes-yes">שאלו אורחים על העדפות תזונה</Label>
                    </div>
                  </RadioGroup>

                  {formData.askSpecialDishes === "yes" && (
                    <div className="mr-6 space-y-2">
                      <Label className="text-sm font-medium">בחרו אפשרויות מנות להציע:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {dishOptions.map((dish) => (
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
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium">הסעות</Label>
                  <RadioGroup
                    value={formData.askTransportation}
                    onValueChange={(value) => setFormData({ ...formData, askTransportation: value })}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="no" id="transport-no" />
                      <Label htmlFor="transport-no">אין צורך לשאול</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="yes" id="transport-yes" />
                      <Label htmlFor="transport-yes">שאלו על צרכי הסעה</Label>
                    </div>
                  </RadioGroup>

                  {formData.askTransportation === "yes" && (
                    <div className="mr-6 space-y-2">
                      <Label htmlFor="transportationCity">עיר ההסעה</Label>
                      <Input
                        id="transportationCity"
                        value={formData.transportationCity}
                        onChange={(e) => setFormData({ ...formData, transportationCity: e.target.value })}
                        placeholder="עיר לאיסוף הסעות"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>תצוגה מקדימה של ההזמנה</CardTitle>
                <CardDescription>בדקו את ההזמנה שלכם לפני השלמה</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white border rounded-lg p-6 mb-6">
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800">{formData.eventNameHebrew}</h2>
                    <div className="flex items-center justify-center space-x-2 space-x-reverse text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formData.eventDate}</span>
                      <Clock className="h-4 w-4 mr-4" />
                      <span>{formData.eventTime}</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 space-x-reverse text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {formData.locationName}, {formData.city}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>רקע:</strong> {backgrounds.find((b) => b.id === formData.selectedBackground)?.name}
                  </p>
                  <p>
                    <strong>שפה:</strong> {formData.language}
                  </p>
                  <p>
                    <strong>מנות מיוחדות:</strong> {formData.askSpecialDishes === "yes" ? "ישאל אורחים" : "לא שואל"}
                  </p>
                  <p>
                    <strong>הסעות:</strong> {formData.askTransportation === "yes" ? "ישאל אורחים" : "לא שואל"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={handlePrevious} disabled={step === 1}>
              הקודם
            </Button>
            {step < 4 ? <Button onClick={handleNext}>הבא</Button> : <Button onClick={handleSubmit}>צרו הזמנה</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
