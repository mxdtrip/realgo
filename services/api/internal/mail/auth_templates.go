package mail

import (
	"fmt"
	"html"
)

func PasswordReset(resetURL string, minutes int) Message {
	text := fmt.Sprintf("Сброс пароля ReAlgo\n\nОткройте ссылку, чтобы установить новый пароль:\n%s\n\nСсылка действует %d минут. Если вы не запрашивали сброс, проигнорируйте это письмо.", resetURL, minutes)
	htmlBody := fmt.Sprintf("<p>Запрошен сброс пароля ReAlgo.</p><p><a href=\"%s\">Установить новый пароль</a></p><p>Ссылка действует %d минут. Если это были не вы, просто проигнорируйте письмо.</p>", html.EscapeString(resetURL), minutes)
	return Message{Subject: "Сброс пароля ReAlgo", Text: text, HTML: htmlBody}
}

func EmailVerification(code string, minutes int) Message {
	text := fmt.Sprintf("Подтверждение email ReAlgo\n\nВведите на сайте код: %s\n\nКод действует %d минут. Если вы не создавали аккаунт, проигнорируйте это письмо.", code, minutes)
	htmlBody := fmt.Sprintf("<p>Подтвердите email в ReAlgo.</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">%s</p><p>Введите код на сайте. Он действует %d минут. Если это были не вы, проигнорируйте письмо.</p>", html.EscapeString(code), minutes)
	return Message{Subject: "Код подтверждения ReAlgo", Text: text, HTML: htmlBody}
}
