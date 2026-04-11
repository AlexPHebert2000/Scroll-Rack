import React from "react";
import axios from 'axios';
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

const Decklist = () => {
  const {id, branch, commit} = useParams()
  const getDecklist = () => {
    const path = branch ? `/api/deck/${id}/${branch}` : `/api/deck/${id}`;
    return axios.get(path);
  }

  const q = useQuery({queryKey: ['deckFetch', id, branch], queryFn: getDecklist});
  return (
    <>Decklist</>
  )
}

export default Decklist;