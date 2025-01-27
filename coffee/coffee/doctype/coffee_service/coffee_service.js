// Copyright (c) 2025, Hudhaifa and contributors
// For license information, please see license.txt

frappe.ui.form.on("Coffee Service", {
    refresh: function(frm) {
        frm.set_query('item_code','table_material', function() {
            return {
                filters: {
                    'is_stock_item': 1  // تصفية العناصر التي لا تؤثر على المخزون
                }
            };
        });
        frm.set_query('service_name', function() {
            return {
                filters: {
                    'is_stock_item': 0  // تصفية العناصر التي لا تؤثر على المخزون
                }
            };
        });
    },
  
});
frappe.ui.form.on('Coffee Service Materials', {
    refresh: function(frm) {
        
    },
    item_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];  
        
        if (row.item_code) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item',
                    name: row.item_code,
                    filters: {
                        'is_stock_item': 1
                    }
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'uom', r.message.stock_uom);
                    }
                }
            });
        }
    },
    
});