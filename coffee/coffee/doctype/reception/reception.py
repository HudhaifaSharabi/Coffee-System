# Copyright (c) 2024, Hudhaifa and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import get_datetime, nowdate

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

    def on_submit(self):
        # Calculate total from services
        total = 0
        for service in self.order_details:
            amount = service.rate 
            total += amount

        # # Calculate total booking payments
        # total_booking_payments = sum(booking_payment.amount for booking_payment in self.booking_payments)
        
        # # Calculate total payments
        # total_payments = sum(payment.amount for payment in self.payments)
        
        # Calculate grand total of all payments
        # grand_total_payments = total_payments + total_booking_payments
        
        # التحقق من المدفوعات حسب الحالة
        # if self.statues == "مؤكد":
        #     if grand_total_payments != total:
        #         frappe.throw(
        #             _("مجموع الدفعات يجب أن يساوي المبلغ الإجمالي المستحق"),
        #             title=_("خطأ في الدفع")
        #         )
        # elif self.statues == "أجل":
        #     if grand_total_payments >= total:
        #         frappe.throw(
        #             _("في حالة التأجيل، يجب أن يكون المبلغ المدفوع أقل من المبلغ الإجمالي"),
        #             title=_("خطأ في الدفع")
        #         )
            
        # Handle material deduction from inventory
        self.deduct_materials()
        
        # Create Sales Invoice based on services
        self.create_sales_invoice()
        
        
    def deduct_materials(self):
        if not self.materials:
            frappe.throw('يرجى تحديد المواد قبل تقديم الطلب.')
        
        # Prepare a list to batch items in a single Stock Entry
        stock_entry_items = []
        # Fetch the cost_center from Coffee Setting
        warehouse = frappe.db.get_single_value('Coffee Setting', 'warehouse')
        warehouse_account = frappe.db.get_single_value('Coffee Setting', 'warehouse_account')

        for material in self.materials:
            # Fetch the latest rate from Stock Ledger Entry
            latest_rate = frappe.get_all(
                'Stock Ledger Entry',
                filters={
                    'item_code': material.item_code,
                    'is_cancelled': 0
                },
                fields=['valuation_rate'],
                order_by='posting_date desc, posting_time desc, creation desc',
                limit=1
            )
            rate = latest_rate[0].valuation_rate if latest_rate else 0

            # Fetch cost_center for the service
            cost_center = frappe.db.get_value(
                'Coffee Service', 
                {'service_name': material.service_name}, 
                'cost_center'
            )

            # Use the default cost_center from Coffee Setting if the fetched cost_center is None
            if not cost_center:
                cost_center = frappe.db.get_single_value('Coffee Setting', 'cost_center')
            

            # Add the material to the items list for batch processing
            stock_entry_items.append({
                'item_code': material.item_code,
                'qty': material.quantity,
                'basic_rate': rate,  # Use the latest rate
                's_warehouse': warehouse,
                'cost_center': cost_center,
                'expense_account': warehouse_account

            })
        
        # Create a single Stock Entry for all materials
        if stock_entry_items:
            stock_entry = frappe.get_doc({
                'doctype': 'Stock Entry',
                'stock_entry_type': 'Material Issue',
                'items': stock_entry_items
            })
            stock_entry.insert()
            stock_entry.submit()
    
    def create_sales_invoice(self):
        items = []  # List to store all items for the Sales Invoice
        total_amount = 0  # Variable to track the total amount of the invoice
        # Fetch the cost_center from Coffee Setting

        for service in self.order_details:
            # Get the latest price
            price_list_rate = get_latest_price(service.item)

            if not price_list_rate:
                frappe.throw(_("لا يوجد سعر محدد للخدمة {0}").format(service.item))

            # Fetch the income_account from Coffee Service
            income_account = frappe.db.get_value(
                'Coffee Service', 
                {'service_name': service.item}, 
                'income_account'
            )

            if not income_account:
                frappe.throw(_("لا يوجد حساب دخل محدد للخدمة {0}").format(service.item))

            cost_center = frappe.db.get_value(
                'Coffee Service', 
                {'service_name': service.item}, 
                'cost_center'
            )

            # Use the default cost_center from Coffee Setting if the fetched cost_center is None
            if not cost_center:
                cost_center = frappe.db.get_single_value('Coffee Setting', 'cost_center')

            # Calculate the amount
            amount = price_list_rate * service.quantity
            total_amount += amount  # Add to the total amount

            # Add the service to the items list
            items.append({
                'item_code': service.item,
                'item_name': service.item,
                'qty': service.quantity,
                'rate': price_list_rate,
                'amount': amount,
                'income_account': income_account,
                'cost_center': cost_center
            })

        if not items:
            frappe.throw(_("لا توجد خدمات لإنشاء فاتورة مبيعات."))

        # Create and submit the Sales Invoice
        sales_invoice = frappe.get_doc({
            'doctype': 'Sales Invoice',
            'customer': self.customer,
            'posting_date': nowdate(),
            'items': items,
            'total': total_amount,
            'grand_total': total_amount,
            'outstanding_amount': total_amount,
        })

        sales_invoice.insert()
        sales_invoice.submit()

        # Call process_payments with the sales_invoice name
        self.process_payments(sales_invoice.name,total_amount)


    def process_payments(self, sales_invoice_name, total_amount):
        # Get the logged-in user
        user = frappe.session.user
        cost_center = frappe.db.get_single_value('Coffee Setting', 'cost_center')
        # Fetch the account from Coffee Employee Settings for the logged-in user
        account = frappe.db.get_value('Coffee Employee Settings', {'user': user}, 'account')

        # If account is not set, throw an error
        if not account:
            frappe.throw(_("لا يوجد حساب محدد لهذا المستخدم ({0})").format(user))

        # Fetch the Sales Invoice to get outstanding amount (if needed)
        sales_invoice = frappe.get_doc("Sales Invoice", sales_invoice_name)

        # Create Payment Entry
        payment_entry = frappe.get_doc({
            'doctype': 'Payment Entry',
            'payment_type': 'Receive',
            'party_type': 'Customer',
            'party': self.customer,
            'paid_amount': total_amount,
            'received_amount': total_amount,
            'paid_to': account,
            'cost_center': cost_center,
            'references': [
                {
                    'reference_doctype': 'Sales Invoice',
                    'reference_name': sales_invoice_name,
                    'total_amount': sales_invoice.grand_total,  # Ensure total amount is added
                    'outstanding_amount': sales_invoice.outstanding_amount,  # Ensure outstanding amount is added
                    'allocated_amount': total_amount,  # The amount to allocate to this reference
                }
            ],
        })

        # Insert and submit the payment entry
        payment_entry.insert()
        payment_entry.submit()

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
@frappe.whitelist()
def get_material(condition_value):
    try:
        sql_query = "select * from `tabCoffee Service Materials` where parent = %s"
        data = frappe.db.sql(sql_query, (condition_value,), as_dict=True)
        return data
    except Exception as e:
        frappe.log_error(f"Error in selecting data: {str(e)}")
        return None


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

@frappe.whitelist()
def get_latest_price(item_code):
    latest_price = frappe.get_all(
        'Item Price',
        filters={
            'item_code': item_code,
            'selling': 1  # للتأكد من أنه سعر بيع
        },
        fields=['price_list_rate'],
        order_by='valid_from desc, modified desc',  # ترتيب حسب تاريخ السريان ثم تاريخ التعديل
        limit=1
    )
    return latest_price[0].price_list_rate if latest_price else None
