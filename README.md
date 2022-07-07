# Mastery (Specs Grading) App
A version of this is live at [sgav3.herokuapp.com](https://sgav3.herokuapp.com/).

## Installation
To run this app locally you need to 
* Clone this repository (or [download it as a zip](archive/refs/heads/main.zip))
* Create a [Google Developer Account](https://console.cloud.google.com/) and get OAuth Credentials [(explained here)](https://developers.google.com/identity/protocols/oauth2/)
* Put those credentials in a .env file in the root directory, alongside mongodb credentials, in the format shown below:
* Ensure you're either running a MongoDB server locally or connected to MongoDB Atlas
* Start the server with `npm start`

**NOTE THAT THE OLDER `config/auth.js` FILE WILL NOT WORK WITH THIS VERSION OF THE APP - THIS VERSION USES DOTENV.** 
(This change was made to simplify deployment on Heroku.)

## .env format
The .env file has the form
``` javascript
MONGO_USER = "your mongo access"
MONGO_PW = "your mongo password"
CLIENT_ID = "your Google OAuth2.0 clientID"
CLIENT_SECRET = "your Google OAuth2.0 Secret"
CALLBACK_URL = "http://127.0.0.1:5500/login/authorized"
IS_ON_WEB = "False"
```

`CALLBACK_URL` and `IS_ON_WEB` can be left as-is for local copies, but should be changed for deployment.

<hr>

# Usage
Basic usage of the app is as follows:
* Once the app is installed, log in, generate a PIN for a new class, and send that PIN out to students. 
    * Students will be able to log in and view problems.
* To make a problem, first make a problem set (such as "Lesson 1") and then create a problem. 
    * Problem sets can be visible or invisible.
* TAs and professors can crea

<hr>

# Features still missing
* No way to change password yet
    * (This is a particular issue for Google users, who have no ability to set a password for usage in local login route)
* About page is incomplete
* Many pages are essentially undocumented
* App does not contain any new features in the main professor/student routes

# CREDITS
The original version of this app was created initially by Tim Hickey, with contributions by Ella Tuson. Bootstrap 5.2.0 overhaul by Viridia Weiss.