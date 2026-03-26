# WORK IN PROGRESS
This is a code learning / problem solving WebApp for a competition

## Small development note:
For the project to properly run locally, you need to have a `.env` file in the root directory with the following variables:

```
DB_URL="dbdriver://user:password@localhost:5432/databasename?sslmode=disable"
# Adjust according to your local database setup

SECRET="yoursecretkeyhere"
# it is advised for the secret to be a random base64 string of at least 32 characters

ADMIN_DEFAULT_PASSWORD="adminpassword"
# Default password for the admin user

SMTP_URL="smtp.mailgun.org:587"
SMTP_USER="user"
SMTP_PASSWORD="password"
# Adjust according to your SMTP server setup

WEBSITE_URL="http://localhost:6767"
# The URL where the website will be accessible at, e.g., http://localhost:6767 for local development
# It will be used in email links

WEBSITE_STATE="development"
# Possible values: development, production
# If left as development, certain features like resetting the entire database will be enabled for easier testing
```