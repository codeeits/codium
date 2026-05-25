<div align="center">
  <h1>Codium/</h1>
  <p>
    <strong>The interactive, web-based computer science learning app.</strong>
  </p>
  <p>
    <a href="https://go.dev/">
      <img src="https://img.shields.io/badge/Go-1.20+-00ADD8?style=flat-square&logo=go" alt="Go Version">
    </a>
    <a href="https://www.postgresql.org/">
      <img src="https://img.shields.io/badge/PostgreSQL-Supported-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">
      <img src="https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
    </a>
  </p>

  <p>
    <a href="#-getting-started">Getting Started</a> •
    <a href="#installation">Installation</a> •
    <a href="#quick-command-guide-for-the-server-console">Commands</a>
  </p>
</div>

<br>

---

## Instalation and utilization guide
### Prerequisites
- Go 1.20 or higher
- A PostgreSQL database (or any other supported by GORM)
- An SMTP server for sending emails (e.g., Mailgun, SendGrid, etc.)
- SSL certificates for HTTPs
- Port forwarding and firewall configuration to allow outside connections to the application ports (8443 for HTTPs and 6767 for HTTP)
### Installation
  1. Clone the repository:
     ```bash
     git clone https://github.com/codeeits/codium.git
     cd codium
     ```
  2. Install dependencies:
     ```bash
     go mod tidy
     ```
  3. Set up the environment variables as described in the development note below.
  4. Run the application:
     ```bash
     go run .
     ```
     Your console will show a message indicating that the server is starting up and then a prompt for a command
     ```
     Starting console...
     >> 
     ```

     From there, it is recommended unless you have active data to send the `reset` command to the server to initialize the database with default data and an admin user:
     ```bash
     >>> reset
     
     ARE YOU SURE...
     >>> yes
     ```
     A database reset will also automatically create an admin user with the email and password specified in the environment variables.
     For a quick guide on the available commands, check [here](#quick-command-guide-for-the-server-console).
  5. Access the application in your web browser either on port 6767 for local development or the configured URL in production.
  
It is of importance to note that, if you're struggling with connecting to the application, check you have port forwarding set up and your firewall is allowing outside connection to ports 8443 and 6767 respectively for HTTPs and HTTP!
If you wish your server to be automatically accessible without needing to mention port 8443, you can port forward outside connections to port 443 to the application port 8443.
### Small development note:
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

### Quick command guide for the server console:
- `reset`: Resets the entire database to its initial state, deleting all data and recreating the default admin user.
- `help`: Displays a list of available commands and their descriptions.
- `stop`: Gracefully stops the server, allowing it to finish processing any ongoing requests before shutting down.

### One last thing
Application logs can be viewed in the /logs/api.log file. 

### Contributing
As this is a software made for a competition, we are not currently accepting contributions. However, if you have any suggestions or would like to contribute in the future, please feel free to reach out to us.
