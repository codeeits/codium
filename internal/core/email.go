package core

import (
	"fmt"

	gomail "gopkg.in/mail.v2"
)

func (cfg *ApiCfg) SendValidationEmail(email string, userId string) {
	go func() {
		err := func() error {
			message := gomail.NewMessage()
			message.SetHeader("From", "codiumOfficial@lekas.tech")
			message.SetHeader("To", email)
			message.SetHeader("Subject", "Email Validation")

			message.SetBody("text/html", fmt.Sprintf(`<h1>Email Validation</h1><br><p>Please verify that your email address is valid by clicking the following link</p><br><a href="%v/api/email/%v">Verify Email</a>`, cfg.WebsiteUrl, userId))

			dialer := gomail.NewDialer(cfg.SmtpCfg.Url, cfg.SmtpCfg.Port, cfg.SmtpCfg.User, cfg.SmtpCfg.Password)
			err := dialer.DialAndSend(message)
			if err != nil {

				return err
			}
			return nil
		}()
		if err != nil {
			cfg.Logger.Println("Failed to send validation email:", err)
		}
	}()
}
