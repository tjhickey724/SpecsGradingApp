# Mastery (Specs) Grading App


## Installation
To run this app locally you need to 
* clone a copy (or download it)
* create a google developer account and get oauth credentials
* put those credentials in a file in config/auth.js in the format shown below:
* startup a mongodb server
* start the server with %npm start


## auth.js format
The config/auth.js file has the form
``` javascript
module.exports = {
    'googleAuth' : {
        'clientID': 'your user clientID',
        'clientSecret': 'your Secret',
        'callbackURL'   : 'http://127.0.0.1:5500/login/authorized'
    }
};
```

