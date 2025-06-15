import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateToken, setTokenCookie } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb'; // Import Mongoose connection utility
import User from '@/models/User'; // Import Mongoose User model

export async function POST(request: Request) {
  try {
    await dbConnect(); // Ensure database is connected

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Missing required fields (email, password)' }, { status: 400 });
    }

    // Find user by email using Mongoose
    const user = await User.findOne({ email }).select('+password'); // Include password for comparison
    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password!);
    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    // Remove password from the user object returned to the client
    // Mongoose's .toJSON() or a custom transform can also handle this
    const userToReturn = {
      _id: user._id.toString(),
      userType: user.userType,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      // selfiePath should likely not be returned on login for privacy/size reasons
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Generate JWT token
    const token = generateToken(userToReturn);

    // Create response
    const response = NextResponse.json(
      { 
        message: 'Login successful', 
        user: userToReturn,
        token // Include token in response body
      },
      { status: 200 }
    );

    // Set the token cookie
    await setTokenCookie(token);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ message: `Internal server error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
