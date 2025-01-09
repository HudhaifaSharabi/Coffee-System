# Copyright (c) 2024, Hudhaifa and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Reception(Document):
    def validate(self):
        """
        Validate the document before saving.
        """
        # Set the user_name field to the currently logged-in user
        if not self.user_name:  # Only set if user_name is not already set
            self.user_name = frappe.session.user

        # Ensure the order_number is set based on the date
        if not self.order_number:
            self.order_number = get_order_number_by_date(self.date)

@frappe.whitelist()
def get_order_number_by_date(date):
    """
    Fetch the next order number for the given date.
    Ensures that each date has sequential order numbers starting from 1.
    """
    if not date:
        frappe.throw("Date is required to fetch the Order Number.")
    
    # Count the number of orders for the given date
    count = frappe.db.count('Reception', filters={'date': date})
    
    # Return the next order number
    return count + 1

@frappe.whitelist()
def mark_as_ready(docname):
    """
    Marks the order as Ready and sends a notification to the user.
    """
    roles = frappe.get_roles(frappe.session.user)
    
    if 'Chif' in roles:
        reception = frappe.get_doc('Reception', docname)

        if not reception.user_name:
            frappe.msgprint('User not found in Reception document.')
            return

        reception.status = 'Ready'
        reception.save()

        
    
    


# def send_ready_notification(user, order_name):
#     """
#     Sends both an in-app notification and a real-time popup to the user.
#     """
#     message = f"Your order {order_name} is ready. Please collect it from the counter."

#     # In-App Notification
#     frappe.get_doc({
#         'doctype': 'Notification Log',
#         'user': user,
#         'subject': 'Order Ready',
#         'content': message,
#         'document_type': 'Reception',
#         'document_name': order_name,
#         'type': 'Alert'
#     }).insert(ignore_permissions=True)

#     # Real-Time Popup Notification
#     frappe.publish_realtime(
#         event='msgprint',
#         message=message,
#         user=user
#     )

#     frappe.msgprint(f"Notifications sent to {user}.")