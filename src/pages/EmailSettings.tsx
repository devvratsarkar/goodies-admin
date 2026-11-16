import { EmailNotificationSettings } from '../components/EmailNotificationSettings'

export function EmailSettings() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Email settings</h1>
          <p className="page-subtitle">Enable or edit email notifications, recipients, subject, and content.</p>
        </div>
      </div>
      <EmailNotificationSettings />
    </>
  )
}
