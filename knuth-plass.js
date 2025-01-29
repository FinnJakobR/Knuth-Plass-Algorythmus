
export const KNUTH_INF = 10000;


class Specifications {
    
    constructor(type, width, stretch, shrink, penalty, flagged, path) {

        this.type = type || "" ; //type of element
        this.width = width ? width :  0.0; // width of element
        this.stretch = stretch ? stretch : 0.0; // for glue 
        this.shrink = shrink ? shrink :  0.0; //for shrink 
        this.penalty = penalty ? penalty : 0.0;
        this.flagged = flagged ? flagged : false; // wenn da ein bindestrich hinkommt
        this.path = path ? path : undefined;
    }

}


/*GLUE ist wie whitespace, das besonder is, das man das shrinken und stretchen kann!*/

export class Glue extends Specifications {

    constructor(shrink, width, stretch, path) {
        super("GLUE", width, stretch, shrink, 0.0, false, path);
    }

    r_width(r) {

        if(r > 0 ){
            return this.width + (r * this.shrink);
        }else {
            return this.width + (r * this.stretch);
        }
    } 

    is_glue() {
        return true;
    }

    cpy() {
        return new Glue(this.shrink, this.width, this.stretch);
    }
}

/*BOX kann egal welche Elemente enthalten, wir nutzen in diesem Fall Wörter aber es kann alles sein, oft verwendet man auch Buchstaben!*/

export class Box extends Specifications {

    constructor(width, path) {
        super(
            "BOX", width, 0.0, 0.0, 0.0, false, path
        );
    }

    is_box() {
        return true;
    }

    copy() {
        return new Box(this.width);
    }
}


//Der Linebreak !

export class Penalty extends Specifications {

    constructor(width, penalty, flagged) {
        super("PENALTY", width, 0.0, 0.0, penalty, flagged);
    }

    is_penalty() {
        return true;
    }

    is_forced_break() {
        return this.penalty >= KNUTH_INF;
    }

    copy() {
        return new Penalty(this.width, this.penalty, this.flagged);
    }
}


class Break {


    constructor(position, line, fitness_class, demerits, previous) {

        this.position = position;
        this.line = line;
        this.fitness_class = fitness_class;
        this.demerits = demerits;
        this.previous = previous;

    }

    copy() {

        return new Break(this.position, this.line, this.fitness_class, this.demerits, this.previous);
    }
}

class LineInfo {

    constructor(totalNumLines, ratio, line_num, line_length, lineContents) {

        this.totalNumLines = totalNumLines;
        this.ratio = ratio;
        this.line_num = line_num;
        this.line_length = line_length;
        this.lineContents = lineContents;

    }

}

class BreakpointInfo {

    constructor(break_point_obj, line_info) {

        this.break_point_obj = break_point_obj;
        this.line_info = line_info;

    }

}


function is_feasible_breakpoint(paragraph, i) {

    if(paragraph[i].type == "PENALTY" && paragraph[i].penalty < KNUTH_INF) return true;

    else if(i > 0 && paragraph[i - 1].type == "BOX" && paragraph[i].type == "GLUE") return true;


    else return false;
}


function minByDemerits(activeNodes) {

    let A = activeNodes[0];

    for (let index = 0; index < activeNodes.length; index++) {
        if(activeNodes[index].demerits < A.demerits) {

            A = activeNodes[index];

        }        
    }

    return A;
  }




export function knuth_plass(paragraph, line_lengths, looseness, tolerance, fitness_demerit, flagged_demerit) {


    looseness = looseness ? looseness : 0;
    fitness_demerit = fitness_demerit ? fitness_demerit : 100;
    flagged_demerit = flagged_demerit ? flagged_demerit : 100;

    let m = paragraph.length;

    if(m == 0) return [];

    const sum_width = new Array(m).fill(0);

    const sum_stretch = new Array(m).fill(0);
    const sum_shrink = new Array(m).fill(0);

    let width_sum = 0;
    let stretch_sum = 0; 
    let shrink_sum = 0;

    paragraph.forEach((spec, i) => {

        sum_width[i] = width_sum;
        sum_stretch[i] = stretch_sum;
        sum_shrink[i] = shrink_sum;

        width_sum+= spec.width;
        stretch_sum+= spec.stretch;
        shrink_sum+= spec.shrink;
    });




    function compute_adjustment_ratio(pos1, pos2, line, line_lengths) {

        let ideal_width = sum_width[pos2] - sum_width[pos1]; 


        let r = KNUTH_INF;

        if(paragraph[pos2].type == "PENALTY"){
            ideal_width+= paragraph[pos2].width;
        }


        let available_width = line_lengths[line_lengths.length - 1];


        if(line < line_lengths.length) {
            available_width = line_lengths[line];

        }

        if(ideal_width < available_width) {

            const y = sum_stretch[pos2] - sum_stretch[pos1]


            if(y > 0) {
                r = (available_width  - ideal_width) / y;
            }else {
                r = KNUTH_INF;
            }


        } else if(ideal_width > available_width) {

            const z = sum_shrink[pos2] - sum_shrink[pos1];


            if(z > 0) {                
                r = (available_width  - ideal_width) / z; 
            }else {

                r = KNUTH_INF;

            }

        }else  {

            r = 0;

        }

        return r;

    }


    let A = new Break(0, 0, 1, 0, undefined);

    const active_nodes = [A];



    function addActiveNode(node) {

        let index = 0;
        let length = active_nodes.length;
        let node_line = node.line;
        let node_fitness_class = node.fitness_class;
        let node_position = node.position;

        while(index < length && active_nodes[index].line < node_line) index++;



        let insert_index = index;


        while(index < length && active_nodes[index].line == node_line) {

            if(active_nodes[index].fitness_class == node_fitness_class && active_nodes[index].position == node_position) 
                return;

            index++;
        }
    

        active_nodes.splice(insert_index, 0, node);
    }

    let breaks_to_deactivate = [];
    let breaks_to_activate = [];

    console.log(paragraph.length);

    paragraph.forEach((B, i) => {


        //hier kannst du breaken

        if(is_feasible_breakpoint(paragraph, i)) {

            for(const F of active_nodes) {
                const r = compute_adjustment_ratio(F.position, i, F.line, line_lengths);

                if(r < -1 || (B.penalty >= KNUTH_INF)){
                    breaks_to_deactivate.push(F);
                }


                if(-1 <= r && r <= tolerance) {

                    let demerits;


                    if(B.type == "PENALTY" && B.penalty >= 0) {
                        demerits = (1 + 100 * Math.pow(Math.pow(Math.abs(r), 3) + B.penalty, 3));
                    }
                    else if(B.penalty > -KNUTH_INF) {
                        demerits = (1 + 100 * Math.pow(Math.pow(Math.abs(r), 3), 2) - Math.pow(B.penalty, 2));
                    } else {
                        demerits = (1 + 100 * Math.pow(Math.pow(Math.abs(r), 3), 2));
                    }

                    

                    if(B.flagged && paragraph[F.position].flagged) {
                        demerits += flagged_demerit;
                    }


                    let fitness_class;

                    if(r < - 0.5) fitness_class = 0;
                    else if(r <= 0.5) fitness_class = 1;
                    else if(r <= 1) fitness_class = 2;
                    else fitness_class = 3;

                    if(Math.abs(fitness_class - F.fitness_class) > 1) {
                        demerits += fitness_demerit;
                    }


                    const brk = new Break(
                        i,
                        F.line + 1,
                        fitness_class,
                        demerits, 
                        F
                    );


                    breaks_to_activate.push(brk);
                }
            }

            for (const node of breaks_to_deactivate) {
                const index = active_nodes.indexOf(node);
                if(active_nodes.length == 0) break;
                if (index !== -1 && active_nodes.length > 1) {
                  active_nodes.splice(index, 1);
                
                }else {
                    break;
                }
              }

            breaks_to_deactivate = [];

            
            for(const node of breaks_to_activate) 
                addActiveNode(node);

            breaks_to_activate = [];

        }

    });





    for(const node of active_nodes) {
        const index = active_nodes.indexOf(node);

        if(index !== -1 && node.position != paragraph.length - 1) {
            active_nodes.splice(index, 1)
        }
    }



    console.assert(active_nodes.length > 0, "Could not find any set of breakpoints that both met the given criteria and ended at the end of the paragraph.")



    A = minByDemerits(active_nodes);

    console.log(A);

    if(looseness != 0) {

        let best = 0;

        let d = KNUTH_INF;
        let b;

        for( const br of active_nodes) {

            const delta = br.line - A.line;

            if((looseness <= delta  && delta < best) || (best < delta && delta < looseness)) {
                d = br.demerits;
                b = br;
            } 
            else if(delta == best && br.demerits < d) {
                d = br.demerits;
                b = br;
            }
        }

        
        A = b;

    }
        const breaks = [];

        while(A) {
            breaks.push(A.position);
            A = A.previous;
        }

        breaks.reverse();


        function getBreakpointsInfo(breaks, line_lengths, paragraph, ret_vals = false) {
            // Wie viele Zeilen?
            const totalNumLines = breaks.length - 1;
        
            // Baue ein Array mit passenden line_lengths auf.
            const lineLengthsArray = line_lengths;
        
            let lineStart = 0;
            let lineNum = 0;
            const results = [];
        
            // Wir starten bei breaks[1], also i = 1, analog zu Python: for break_point in breaks[1:]
            
            
            for (let i = 1; i < breaks.length; i++) {
            const breakPoint = breaks[i];
            const lineLength = lineLengthsArray[lineNum];
        
            // Berechne ratio (analog zu Python-Funktion).
            const ratio = compute_adjustment_ratio(lineStart, breakPoint, lineNum, line_lengths);
        
            // "line_contents": In Python war das ein Generator von paragraph[lineStart..breakPoint].
            // Hier einfach ein Array-Slice:
            const lineContents = paragraph.slice(lineStart, breakPoint);
        
            // Erzeuge das entsprechende Info-Objekt
            const lineInfo = new LineInfo(
                totalNumLines,
                ratio,
                lineNum + 1,       // +1, weil Python das ab Zeile 1 zählen wollte
                lineLength,
                lineContents
            );
            const bpInfo = new BreakpointInfo(breakPoint, lineInfo);
        
            results.push(bpInfo);
        
            // Update für die nächste Zeile
            lineNum++;
            lineStart = breakPoint + 1;
            }
            
            return results;
        }

        return getBreakpointsInfo(breaks, line_lengths, paragraph, false);


}