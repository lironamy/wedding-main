import { NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb'; // Import Mongoose connection utility
import User from '@/models/User'; // Import Mongoose User model
import { Types } from 'mongoose'; // Import Types for ObjectId validation

export async function GET() {
  try {
    await dbConnect(); // Ensure database is connected

    const token = await getTokenFromCookie();
    
    if (!token) {
      return NextResponse.json({ message: 'No session' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id: string }; // Assuming verifyToken returns an object with id
    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: 'Invalid session token' }, { status: 401 });
    }

    // Validate if decoded.id is a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(decoded.id)) {
        return NextResponse.json({ message: 'Invalid user ID in session token' }, { status: 400 });
    }

    const user = await User.findById(decoded.id).select('-password'); // Exclude password

    if (!user) {
      return NextResponse.json({ message: 'User not found or session invalid' }, { status: 401 });
    }

    // Return a structured user object, similar to login/register
    const userToReturn = {
        _id: user._id.toString(),
        userType: user.userType,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        // selfiePath should likely not be returned here for privacy/size reasons
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };

    return NextResponse.json({ user: userToReturn }, { status: 200 });
  } catch (error) {
    console.error('Session check error:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 