// Function to show quantity dialog with service name
function show_quantity_dialog(item_code, item, item_rate, frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('ادخل الكميه'),
        fields: [
            {
                label: __('Service Name'),
                fieldname: 'service_name',
                fieldtype: 'Link', // Change to Link field
                options: 'Coffee Store', // Link to the Item DocType
                default: item, // Use the item_code as the value
                read_only: 1, // Make it read-only if needed
                placeholder: __('الخدمه: ') + item, // Display item as a placeholder
            },
            {
                label: __('السعر'),
                fieldname: 'item_rate',
                fieldtype: 'Currency',
                default: item_rate,
                read_only: 1,
            },
            {
                label: __('الكمية'),
                fieldname: 'quantity',
                fieldtype: 'Float',
                reqd: 1,
            }
        ],
        primary_action_label: __('Add to Order'),
        primary_action(values) {
            if (values.quantity > 0) {
                // Calculate the total
                let total = values.quantity * values.item_rate;
                // Add the item to the child table
                let child = frm.add_child('order_details');

                frappe.model.set_value(child.doctype, child.name, 'item', item_code);
                frappe.model.set_value(child.doctype, child.name, 'quantity', values.quantity);
                frappe.model.set_value(child.doctype, child.name, 'rate', item_rate);
                frappe.model.set_value(child.doctype, child.name, 'total', total);
                frappe.model.set_value(child.doctype, child.name, 'item_name', item);

                frm.refresh_field('order_details'); // Refresh the child table
                dialog.hide();
            } else {
                frappe.msgprint(__('Please enter a valid quantity.'));
            }
        },
    });

    dialog.$wrapper.css('z-index', 2000); // Set z-index higher than other dialogs
    dialog.show();
}

// Function to fetch and display items by Item Group
async function show_items_by_group(item_group_name, frm) {
    const placeholderImage = '/assets/frappe/images/item-placeholder.png';
    let buttons_html = `<div style="display: flex; flex-wrap; wrap; justify-content: space-evenly; gap: 15px;">`;

    try {
        let response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Coffee Service',
                filters: {
                    
                    'category': item_group_name,
                },
                fields: ['name', 'service_name', 'image' ,'rate'],
            },
        });

        let items = response.message || [];
        if (!items.length) {
            frappe.msgprint(__('No items found for this group.'));
            return;
        }

        items.forEach(function (item) {
            let item_image = item.image || placeholderImage;
            buttons_html += `
                 <div style="width: 100px; margin: 10px; text-align: center; flex-shrink: 0;">
                    <button class="btn btn-secondary" style="width: 100%; height: 100px; border-radius: 10px; padding: 0; text-align: center; 
                        background-image: url('${item_image}'); background-size: cover; background-position: center; color: white; display: flex; 
                        justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
                        data-item-name="${item.service_name}" data-item-code="${item.name}" data-item-rate="${item.rate}">
                        <p style="font-size: 12px; margin: 0; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);">${item.service_name} : ${item.rate}</p>
                    </button>
                </div>
            `;
        });

        buttons_html += `</div>`;

        frappe.msgprint({
            title: __('Items for Group: ') + item_group_name,
            message: buttons_html,
            indicator: 'blue',
        });

        // Add event listeners for the dynamically created buttons
        setTimeout(() => {
            document.querySelectorAll('.btn.btn-secondary').forEach(function (button) {
                button.addEventListener('click', function () {
                    let item = this.getAttribute('data-item-name');
                    let item_code = this.getAttribute('data-item-code');
                    let item_rate = this.getAttribute('data-item-rate');

                    // Show quantity dialog for the selected item
                    show_quantity_dialog(item_code, item, item_rate, frm);
                });
            });
        }, 500); // Ensure the DOM is loaded
       
    } catch (error) {
        frappe.msgprint(__('Failed to fetch items: ') + error.message);
    }
}

// Frappe form trigger for 'Reception'
frappe.ui.form.on('Reception', {


    refresh: function (frm) {
        // Add "Mark as Ready" button
        if (frappe.user.has_role('Chif') && frm.doc.status != "Ready") {
            frm.add_custom_button(__('الطلب مكتمل'), function () {
                frappe.call({
                    method: 'coffee.coffee.doctype.reception.reception.mark_as_ready',
                    args: {
                        docname: frm.doc.name  // Ensure you're passing the docname
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frm.reload_doc(); // Reload the form to update the status
                        }
                    }
                });
            }).addClass('btn-primary');
        }

        // Fetch Item Groups and generate buttons dynamically
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Item Group',
                filters: {
                    'parent_item_group': 'Coffee Store',
                },
                fields: ['name', 'item_group_name', 'image'],
            },
            callback: function (response) {
                let item_groups = response.message || [];
                let buttons_html = '<div style="display: flex; flex-wrap: wrap;">';

                // Loop through Item Groups and create buttons
                    item_groups.forEach(function (item_group) {
                        let image = item_group.image || '/assets/frappe/images/item-placeholder.png';
                        let icon_html = `
                            <div style="width: 100%; height: 100%; background-image: url('${image}'); background-size: cover; background-position: center; 
                                border-radius: 10px; display: flex; justify-content: center; align-items: center; padding: 20px;">
                                <p style="font-size: 14px; color: white; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);">${item_group.item_group_name}</p>
                            </div>`;

                        buttons_html += `
                            <div style="width: 150px; margin: 10px; text-align: center; flex-shrink: 0;">
                                <button class="btn btn-primary" style="width: 100%; height: 200px; border-radius: 10px; padding: 0; text-align: center;" 
                                        id="show_items_${item_group.name}">
                                    ${icon_html}
                                </button>
                            </div>
                        `;
                    });

                buttons_html += `</div>`;
                frm.fields_dict['categories_buttons'].html(buttons_html);
                frm.refresh_field('categories_buttons');

                // Add event listeners for buttons
                item_groups.forEach(function (item_group) {
                    document.getElementById(`show_items_${item_group.name}`).addEventListener("click", function () {
                        show_items_by_group(item_group.name, frm);
                    });
                });
            },
        });
    },
   // Add a button for the chef
   before_save: function(frm) {
    // Call the print function before saving
    select_printer_and_print(print_arabic_utf8, frm);
}
});

function calculate_grand_total(frm) {
    let grand_total = 0;

    (frm.doc.order_details || []).forEach(function (row) {
        grand_total += row.total || 0;
    });

    frm.set_value('total', grand_total);
}

// // Trigger grand total calculation on row changes in the child table
frappe.ui.form.on('Order Details', {
    quantity: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.total = row.quantity * row.rate;
        frm.refresh_field('order_details');
        calculate_grand_total(frm);
    },
    
    rate: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.total = row.quantity * row.rate;
        frm.refresh_field('order_details');
        calculate_grand_total(frm);
    },
    order_details_remove: function (frm) {
        calculate_grand_total(frm);
    },
});


function select_printer_and_print(printFunction, frm) {
    frappe.ui.form.qz_connect()
        .then(() => qz.printers.find())
        .then(printers => {
            const selected_printer = prompt(
                "Select a printer:\n" + printers.join("\n"),
                printers[0] // Default to the first printer
            );

            if (selected_printer) {
                printFunction(frm, selected_printer);
            } else {
                frappe.msgprint("No printer selected.");
            }
        })
        .catch(error => frappe.msgprint(`Error: ${error}`));
}
function print_arabic_utf8(frm, printer) {
    const config = qz.configs.create(printer);

    // Customer Invoice HTML
    const customerInvoice = `
      




        <div style="font-family: Arial, sans-serif; margin: 0; padding: 0; height: 100vh; position: relative; background: url('http://localhost:82/files/logo_-1.png') no-repeat center center; background-size: contain;" dir="rtl">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="margin: 0; font-size: 20px;">فاتورة العميل</h2>
            </div>
            <div dir="rtl">
                <p><strong>التاريخ:</strong> ${frm.doc.date}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <p style="margin: 0; font-size: 14px; font-weight: bold; direction: rtl;">رقم الطلب: ${frm.doc.order_number}</p>
                    <p style="margin: 0; font-size: 14px; font-weight: bold; direction: rtl;">رقم الطاولة: ${frm.doc.table_no}</p>
                </div>
                

                <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
                <h4 style="margin-bottom: 10px;">تفاصيل الطلب:</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="text-align: left;">
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: center; ">المنتج</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">الكمية</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">السعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${frm.doc.order_details.map(row => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${row.item_name}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${row.quantity}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${row.rate}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <p style="margin: 0; font-size: 14px; font-weight: bold; direction: rtl;"><strong>الإجمالي:</strong> ${frm.doc.total}</p>
                        <p style="margin: 0; font-size: 12px; font-weight: bold; direction: rtl;"><strong>المستخدم:</strong> ${frm.doc.user_name}</p>
                    </div>
                    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
                    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
                    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">


                </div>
            </div>
        </div>
    `;

    // Chef Invoice HTML
    const chefInvoice = `
    <div style="font-family: Arial, sans-serif; margin: 20px;" dir="rtl">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;"> الشيف</h2>
        </div>
        <div dir="rtl">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <p style="margin: 0; font-size: 14px; font-weight: bold; direction: rtl;">رقم الطلب: ${frm.doc.order_number}</p>
                <p style="margin: 0; font-size: 14px; font-weight: bold; direction: rtl;">رقم الطاولة: ${frm.doc.table_no}</p>
            </div>
            <p><strong>التاريخ:</strong> ${frm.doc.date}</p>
            <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
            <h4 style="margin-bottom: 10px;">تفاصيل الطلب:</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background-color: #f5f5f5; text-align: left;">
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">المنتج</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">الكمية</th>
                    </tr>
                </thead>
                <tbody>
                    ${frm.doc.order_details.map(row => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${row.item_name}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${row.quantity}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
    <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
`;
    // Print Customer Invoice
    qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: customerInvoice }])
        .then(() => {
            frappe.show_alert({ message: 'فاتورة العميل تم إرسالها للطباعة!', indicator: 'green' });

            // Print Chef Invoice after Customer Invoice
            return qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: chefInvoice }]);
        })
        .then(() => frappe.show_alert({ message: 'طلب الشيف تم إرساله للطباعة!', indicator: 'green' }))
        .catch(error => frappe.msgprint(`خطأ: ${error}`));
}