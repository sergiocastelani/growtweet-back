import express from 'express'
import { processAndRespond } from './controller_utils';
import { VisitService } from '../services/visit_service';

const visit_controller = express.Router()
export default visit_controller;

visit_controller.post('/visits', (req, res) => {
    processAndRespond(res, async () => await (new VisitService()).register());
})

visit_controller.get('/visits/total', (req, res) => {
    processAndRespond(res, async () => await (new VisitService()).total());
})
