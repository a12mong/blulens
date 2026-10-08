import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-subj-fields-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /api/v1/assessments - subject/event/assignment fields (bl-26-6)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let subjectId: string;
  let committeeId: string;
  let reviewer1Id: string;
  let reviewer2Id: string;

  let subjectCookie: string;
  let committeeCookie: string;
  let reviewer1Cookie: string;
  let reviewer2Cookie: string;

  let tournamentId: string;
  let eventId: string;
  let team1Id: string;
  let team2Id: string;
  let assessmentId: string;
  let assignment1Id: string;
  let assignment2Id: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create subject user with 2 memberships (one active, one ended)
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Assessment Subject`,
      },
    });
    subjectId = subject.id;
    subjectCookie = cookieFor(subjectId, ['Member']);

    // Create committee
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-committee@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = committee.id;
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // Create 2 reviewers
    const reviewer1 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 1`,
      },
    });
    reviewer1Id = reviewer1.id;
    reviewer1Cookie = cookieFor(reviewer1Id, ['Reviewer']);

    const reviewer2 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 2`,
      },
    });
    reviewer2Id = reviewer2.id;
    reviewer2Cookie = cookieFor(reviewer2Id, ['Reviewer']);

    // Create 2 teams
    const team1 = await prisma.team.create({
      data: { name: `${tag} Team A`, nameKey: tag.toLowerCase() },
    });
    team1Id = team1.id;

    const team2 = await prisma.team.create({
      data: { name: `${tag} Team B`, nameKey: `${tag.toLowerCase()}-b` },
    });
    team2Id = team2.id;

    // Create memberships: active in team1, ended in team2
    const now = new Date();
    const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await prisma.teamMembership.createMany({
      data: [
        { userId: subjectId, teamId: team1Id, validFrom: dayBeforeYesterday, validTo: null }, // active
        { userId: subjectId, teamId: team2Id, validFrom: dayBeforeYesterday, validTo: yesterday }, // ended
      ],
    });

    // Create tournament and event
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        startsOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        entriesCloseAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    });
    tournamentId = tournament.id;

    const event = await prisma.event.create({
      data: {
        tournamentId,
        discipline: 'MD',
        gradeMinIndex: 0,
        gradeMaxIndex: 14,
      },
    });
    eventId = event.id;

    // Create assessment for subject
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subjectId,
        eventId,
        status: 'in_review',
        reviewsRequired: 2,
      },
    });
    assessmentId = assessment.id;

    // Create 2 review assignments (one open, one submitted)
    const assignment1 = await prisma.reviewAssignment.create({
      data: {
        assessmentId,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assignment1Id = assignment1.id;

    // Create review for assignment 2
    const assignment2 = await prisma.reviewAssignment.create({
      data: {
        assessmentId,
        reviewerId: reviewer2Id,
        state: 'submitted',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assignment2Id = assignment2.id;

    await prisma.review.create({
      data: {
        assignmentId: assignment2Id,
        submittedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.reviewAssignment.deleteMany({ where: { assessmentId } });
    await prisma.review.deleteMany({ where: { assignment: { assessmentId } } });
    await prisma.assessment.deleteMany({ where: { id: assessmentId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    await prisma.teamMembership.deleteMany({ where: { userId: subjectId } });
    await prisma.team.deleteMany({ where: { id: { in: [team1Id, team2Id] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [subjectId, committeeId, reviewer1Id, reviewer2Id] } },
    });
  });

  describe('GET /assessments (list)', () => {
    it('Committee sees subject name and active club names', async () => {
      const res = await http()
        .get('/api/v1/assessments')
        .set('Cookie', committeeCookie)
        .expect(200);

      const item = res.body.items.find((a: any) => a.id === assessmentId);
      expect(item).toBeDefined();
      expect(item.subject).toBeDefined();
      expect(item.subject.userId).toBe(subjectId);
      expect(item.subject.displayName).toBe(`${tag} Assessment Subject`);
      expect(item.subject.clubNames).toEqual([`${tag} Team A`]); // only active membership
    });

    it('Committee sees event with tournament name', async () => {
      const res = await http()
        .get('/api/v1/assessments')
        .set('Cookie', committeeCookie)
        .expect(200);

      const item = res.body.items.find((a: any) => a.id === assessmentId);
      expect(item.event).toBeDefined();
      expect(item.event.id).toBe(eventId);
      expect(item.event.discipline).toBe('MD');
      expect(item.event.tournamentName).toBe(`${tag} Tournament`);
    });
  });

  describe('GET /assessments/{id} (detail)', () => {
    it('Committee sees assignments with open and submitted states', async () => {
      const res = await http()
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Cookie', committeeCookie)
        .expect(200);

      expect(res.body.assignments).toBeDefined();
      expect(res.body.assignments.length).toBe(2);

      // First assignment (open)
      const open = res.body.assignments.find((a: any) => a.id === assignment1Id);
      expect(open).toBeDefined();
      expect(open.state).toBe('open');
      expect(open.submittedAt).toBeNull();
      expect(open.reviewerId).toBe(reviewer1Id);
      expect(open.reviewerName).toBe(`${tag} Reviewer 1`);

      // Second assignment (submitted)
      const submitted = res.body.assignments.find((a: any) => a.id === assignment2Id);
      expect(submitted).toBeDefined();
      expect(submitted.state).toBe('submitted');
      expect(submitted.submittedAt).toBeDefined();
      expect(submitted.reviewerId).toBe(reviewer2Id);
      expect(submitted.reviewerName).toBe(`${tag} Reviewer 2`);
    });

    it('Subject (Member) sees empty assignments array', async () => {
      const res = await http()
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Cookie', subjectCookie)
        .expect(200);

      expect(res.body.assignments).toBeDefined();
      expect(res.body.assignments.length).toBe(0);
    });

    it('Subject sees subject and event fields', async () => {
      const res = await http()
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Cookie', subjectCookie)
        .expect(200);

      expect(res.body.subject).toBeDefined();
      expect(res.body.subject.displayName).toBe(`${tag} Assessment Subject`);
      expect(res.body.subject.clubNames).toEqual([`${tag} Team A`]);

      expect(res.body.event).toBeDefined();
      expect(res.body.event.tournamentName).toBe(`${tag} Tournament`);
    });
  });
});
