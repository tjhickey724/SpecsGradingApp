# Mastery (Specs Grading) App
A version of this is live at [sgav3.herokuapp.com](https://sgav3.herokuapp.com/).

## Installation
To run this app locally you need to 
* clone a copy (or download it)
* create a google developer account and get oauth credentials
* put those credentials in a .env file in the root directory in the format shown below:
* connect to a mongodb server
* start the server with %npm start


## .env format
The .env file has the form
``` javascript
MONGO_USER = "your mongo access"
MONGO_PW = "your mongo password"
CLIENT_ID = 'your user clientID'
CLIENT_SECRET = 'your Secret'
CALLBACK_URL = 'http://127.0.0.1:5500/login/authorized'
```

