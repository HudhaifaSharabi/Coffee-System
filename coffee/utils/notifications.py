import frappe

def create_notification_log(subject, user, doc_type=None, doc_name=None, email_content=None, notification_type='Alert'):
    """
    Creates a Notification Log entry programmatically.

    :param subject: Subject of the notification.
    :param user: User to notify.
    :param doc_type: Linked doctype (optional).
    :param doc_name: Linked document name (optional).
    :param email_content: Content of the email/notification.
    :param notification_type: Type of notification ('Alert', 'Warning', etc.).
    """
    if not user:
        frappe.throw("User is required to create a notification.")

    notification = frappe.new_doc('Notification Log')
    notification.update({
        'subject': subject,
        'for_user': user,
        'type': notification_type,
        'document_type': doc_type,
        'document_name': doc_name,
        'email_content': email_content,
    })
    notification.insert(ignore_permissions=True)
    frappe.db.commit()  # Ensure the record is saved to the database
