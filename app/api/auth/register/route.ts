import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb'; // Import Mongoose connection utility
import User from '@/models/User'; // Import Mongoose User model

export async function POST(request: Request) {
  try {
    await dbConnect(); // Ensure database is connected

    const { name, email, password, phoneNumber, userType } = await request.json();

    if (!name || !email || !password || !phoneNumber) {
      return NextResponse.json({ message: 'Missing required fields (name, email, password, phoneNumber)' }, { status: 400 });
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
    }

    // Password strength (example: at least 6 characters)
    if (password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 409 }); // 409 Conflict
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds: 10

    // Create new user with Mongoose
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      userType: userType || 'guest', // Default to 'guest' if not provided
      isVerified: false, // Default to false, verification flow needed
    });

    await newUser.save();

    // Remove password from the user object returned to the client
    // Mongoose's .toJSON() or a custom transform can also handle this
    const userToReturn = {
        _id: newUser._id.toString(),
        userType: newUser.userType,
        name: newUser.name,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        isVerified: newUser.isVerified,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
    };

    return NextResponse.json({ message: 'User registered successfully', user: userToReturn }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    // Handle Mongoose validation errors specifically if needed
    if (error.name === 'ValidationError') {
      return NextResponse.json({ message: 'Validation Error', errors: error.errors }, { status: 400 });
    }
    // Check if the error is a known type, otherwise generic message
    if (error instanceof Error) {
        return NextResponse.json({ message: `Internal server error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
