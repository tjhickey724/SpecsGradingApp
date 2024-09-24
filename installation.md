# Installing and Deploying MLA
The Mastery Learning App is open source and you can deploy it yourself if you want.
You run a local version or a cloud-based version (but that requires more setup).

## Deploying MLA locally
This is pretty easy.
1. clone the MLA site
2. startup mongodb
3. get google credentials for authentication
4. create a .env file as described below
5. run nodemon

Same .env file
``` bash
CLIENT_ID=GOOGLE_CLIENT_ID_GOES_HERE
CLIENT_SECRET=GOOGLE_SECRET_GOES_HERE
CALLBACK_URL=http://127.0.0.1:5500/login/authorized
MONGODB_URL=mongodb://localhost:27017/PICK_A_DATABASE_NAME
UPLOAD_TO = "LOCAL" # "LOCAL" or "AWS"
```

## Deploying to the cloud
This is a work in progress. You can easily change the MONGODB_URL to a cloud-based database
and we're working on allowing the app to upload to the AWS S3 storage system.
Our next step is to deploy it to render.com so it can be fully scalable!
