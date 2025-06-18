import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';
import User from '@/models/User';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import { IDetectedFace } from '@/models/Photo';

interface IMatchedUser {
  _id: string;
  name: string;
}

export async function GET(request: Request) {
    try {
        await dbConnect();

        // Verify main user authentication
        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }
        const decodedToken = verifyToken(token) as { id: string };
        if (!decodedToken || !decodedToken.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        const mainUser = await User.findById(decodedToken.id);
        if (!mainUser || mainUser.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
        }

        // Find all photos with matched faces
        const matchedPhotos = await Photo.aggregate([
            {
                $match: {
                    'detectedFaces.matchedUser': { $exists: true, $ne: null }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'detectedFaces.matchedUser',
                    foreignField: '_id',
                    as: 'matchedUsers'
                }
            },
            {
                $project: {
                    imageUrl: 1,
                    detectedFaces: 1,
                    matchedUsers: 1,
                    matches: {
                        $map: {
                            input: '$detectedFaces',
                            as: 'face',
                            in: {
                                guestName: {
                                    $let: {
                                        vars: {
                                            matchedUser: {
                                                $arrayElemAt: [
                                                    {
                                                        $filter: {
                                                            input: '$matchedUsers',
                                                            as: 'user',
                                                            cond: { $eq: ['$$user._id', '$$face.matchedUser'] }
                                                        }
                                                    },
                                                    0
                                                ]
                                            }
                                        },
                                        in: '$$matchedUser.name'
                                    }
                                },
                                confidence: '$$face.matchConfidence'
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    imageUrl: 1,
                    guestNames: {
                        $map: {
                            input: '$matches',
                            as: 'match',
                            in: '$$match.guestName'
                        }
                    },
                    confidences: {
                        $map: {
                            input: '$matches',
                            as: 'match',
                            in: '$$match.confidence'
                        }
                    }
                }
            }
        ]);

        return NextResponse.json({
            matches: matchedPhotos.map(photo => ({
                photoUrl: photo.imageUrl,
                guestNames: photo.guestNames.filter(Boolean),
                confidences: photo.confidences.filter((c: number | null | undefined) => c !== null && c !== undefined)
            }))
        });
    } catch (error: any) {
        console.error('Error fetching matched photos:', error);
        return NextResponse.json({ 
            message: 'Error fetching matched photos',
            error: error.message 
        }, { status: 500 });
    }
} 