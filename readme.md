# FastAttendance: A Real-Time PIN and Session-Enabled Attendance System Using Google Sheets and Google Apps Script

## 📌 Overview

FastAttendance is a lightweight, web-based attendance management system designed for real-time classroom use. It uses **Google Sheets as the database** and **Google Apps Script as the backend**, enabling teachers to conduct secure, session-based attendance using a PIN system.

This system eliminates manual attendance marking and provides an automated, fast, and structured way to track student presence.

\---

## 🎯 Key Idea

The system introduces a **session-based attendance mechanism**, where each class attendance is controlled by a temporary session created by the teacher. Students can only mark attendance within the active session using a unique PIN.

\---

## ⚙️ How It Works

### 👨‍🏫 Teacher Flow

1. Open the web app link
2. Login using teacher password
3. Select class section
4. Start an attendance session
5. System generates a **4-digit PIN**
6. Share PIN with students
7. Monitor live attendance

### 🎓 Student Flow

1. Open the same web app link
2. Select section
3. Choose roll number
4. Enter session PIN
5. Submit attendance

\---

## 📊 Data Structure (Google Sheets)

Each Google Spreadsheet acts as the database:

* Each **sheet tab = one class section**
* Row 1 = headers (`Roll`, `Name`, Date columns)
* Rows = student list
* Columns = dates (auto-generated during session)

### Attendance Marking

* `P` → Present
* `A` → Absent (optional/manual)
* Blank → Not marked

\---

## 🧠 Key Features

* ✔ Real-time attendance tracking
* ✔ Session-based control system
* ✔ PIN-protected attendance marking
* ✔ Automatic date column generation
* ✔ Multi-section support using sheet tabs
* ✔ Live monitoring of student submissions
* ✔ Fully free using Google Workspace tools
* ✔ Mobile and desktop friendly interface

\---

## 🔐 Security Features

* Teacher password authentication
* Session PIN validation
* Time-limited attendance window
* Backend-controlled sheet writing (no direct student access)
* One active session per section

\---

## 🏗 System Architecture

```
Student / Teacher Browser
        ↓
Google Apps Script Web App
        ↓
Google Sheets (Database)
```

\---

## 🚀 Deployment Steps

### 1\. Create Google Sheet

* Go to Google Sheets
* Create a new spreadsheet
* Add one sheet per class section
* Add columns: Roll, Name

### 2\. Add Apps Script

* Go to Extensions → Apps Script
* Paste `Code.gs`
* Create `Index.html`

### 3\. Set Teacher Password

* Run `setTeacherPassword()` function once

### 4\. Deploy Web App

* Click Deploy → New Deployment
* Select Web App
* Set access to “Anyone”
* Copy the generated URL

\---

## 📱 Usage

### 👨‍🏫 Teacher

* Open web app
* Start session
* Share PIN
* Monitor attendance in real-time

### 🎓 Student

* Open web app
* Select roll number
* Enter PIN
* Submit attendance

\---

## ⚠️ Limitations

* Only one active session per section
* Requires internet connection
* Google verification warning may appear during first setup
* Best suited for small to medium-sized classrooms

\---

## 💡 Future Improvements

* QR code-based attendance system
* GPS/location verification
* Email-based login tracking
* Face recognition integration
* Advanced analytics dashboard

\---

## 📌 Tech Stack

* Google Sheets
* Google Apps Script (JavaScript)
* HTML, CSS, JavaScript (Frontend)

\---

## 👨‍💻 Author

Developed as a lightweight educational project for smart and automated attendance management using Google Workspace tools.

