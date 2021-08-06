# Peer Review App

This webapp is designed to allow instructors to create questions with hidden grading rubrics. The students answer the questions and then are asked to review the (anonymous) answers of their peers. They are also encouraged to rate the reviews of their peers, and especially the reviews of their own answers.

The hope is that by reviewing other students' work, they will develop deeper understandings of the problem and its possible solutions.

The instructor and student can view metrics relating to their performance (e.g. number of problems answered, number of reviews written, average review score on each problem)

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
        'callbackURL'   : 'http://127.0.0.1:6500/login/authorized'
    }
};
```

