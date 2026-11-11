import express from 'express'
import { processAndRespond } from './controller_utils';
import { VisitService } from '../services/visit_service';

const visit_controller = express.Router()
export default visit_controller;

/** Value of `last` when it is missing or not an integer (FR-10). */
const DEFAULT_LIST_DAYS = 10;
const INTEGER_PATTERN = /^-?\d+$/;

/** Parses the raw `last` query value; anything that is not a single integer string gives DEFAULT_LIST_DAYS. */
function parseLastParam(raw: unknown) : number
{
    return (typeof raw === 'string' && INTEGER_PATTERN.test(raw)) ? Number(raw) : DEFAULT_LIST_DAYS;
}

visit_controller.post('/visits', (req, res) => {
    processAndRespond(res, async () => await (new VisitService()).register());
})

visit_controller.get('/visits/total', (req, res) => {
    processAndRespond(res, async () => await (new VisitService()).total());
})

visit_controller.get('/visits', (req, res) => {
    processAndRespond(res, async () => await (new VisitService()).list(parseLastParam(req.query.last)));
})
