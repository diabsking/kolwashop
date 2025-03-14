const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Mailo configuration
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD || "1O0C4HbGFMSw" // Use environment variable for password
  }
});

// Display cart
exports.viewCart = (req, res) => {
  res.status(200).json({ message: "Cart display" });
};

// Add product to cart
exports.addToCart = (req, res) => {
  res.status(200).json({ message: "Product added to cart" });
};

// Confirm order
exports.confirmOrder = async (req, res) => {
  try {
    // Extract data from request body (keys in English)
    const { email, address, phoneNumber, cartItems, customerName } = req.body;
    
    // Validate required fields
    if (
      !email?.trim() ||
      !address?.trim() ||
      !phoneNumber?.trim() ||
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      return res.status(400).json({ message: "All fields are required and the cart cannot be empty!" });
    }
    
    // Determine customer name (use provided name or derive from email)
    const clientName = customerName && customerName.trim() ? customerName.trim() : email.split("@")[0];
    const shippingAddress = address;
    
    // Map cart items to internal structure
    const mappedCartItems = cartItems.map(item => ({
      name: item.name,
      price: item.price,
      description: item.description || "",
      imageUrl: item.imageUrl,
      sellerEmail: item.sellerEmail,
      quantity: item.quantity || 1,
      addedAt: item.addedAt || new Date()
    }));
    
    const sellerOrders = {};
    
    // Save each order and group them by seller
    for (const item of mappedCartItems) {
      if (!item.sellerEmail) {
        console.warn(`Product "${item.name}" missing seller email.`);
        continue;
      }
      
      const newOrder = new Order({
        customerName: clientName,
        email,
        shippingAddress,
        phoneNumber,
        product: {
          name: item.name,
          price: item.price,
          description: item.description,
          imageUrl: item.imageUrl,
          sellerEmail: item.sellerEmail,
          quantity: item.quantity
        },
        orderStatus: "Order Processing"
      });
      
      await newOrder.save();
      
      if (!sellerOrders[item.sellerEmail]) {
        sellerOrders[item.sellerEmail] = [];
      }
      sellerOrders[item.sellerEmail].push(newOrder);
    }
    
    // Send emails to sellers
    for (const sellerEmail in sellerOrders) {
      const ordersBySeller = sellerOrders[sellerEmail];
      const productDetails = ordersBySeller.map(order =>
        `- ${order.product.name} (${order.product.quantity} x ${order.product.price} FCFA)\n📷 Photo: ${order.product.imageUrl}`
      ).join("\n\n");
      
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "New Order Received",
        text: `Hello,\n\nYou have received a new order.\n\n🛒 Order Details:\n${productDetails}\n\n📍 Shipping Information:\n👤 Customer: ${clientName}\n📍 Address: ${shippingAddress}\n📞 Phone: ${phoneNumber}\n\nPlease process this order promptly.\n\n— Kolwaz Shop`
      });
    }
    
    // Send confirmation email to customer
    const clientProducts = mappedCartItems.map(item =>
      `- ${item.name} (${item.quantity} x ${item.price} FCFA)`
    ).join("\n");
    
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: email,
      subject: "Your Order Confirmation",
      text: `Hello ${clientName},\n\n✅ Your order has been successfully placed!\n\n🛒 Order Details:\n${clientProducts}\n\n🚚 Your order is being processed and will be shipped to:\n📍 ${shippingAddress}\n📞 ${phoneNumber}\n\nThank you for your trust!\n\n— Kolwaz Shop`
    });
    
    res.status(200).json({ message: `Order confirmed for ${mappedCartItems.length} product(s).` });
  } catch (err) {
    console.error("Error confirming order:", err);
    res.status(500).json({ error: err.message });
  }
};

// Confirm delivery
exports.confirmDelivery = (req, res) => {
  res.status(200).json({ message: "Delivery confirmed" });
};
